const crypto = require("crypto");
const BranchAuth = require("../../../models/customer/branch/branchAuthModel");
const Common = require("../../../models/customer/branch/commonModel");
const AdminCommon = require("../../../models/admin/commonModel");
const AppModel = require("../../../models/appModel");

// Utility function to generate a random token
const generateToken = () => crypto.randomBytes(32).toString("hex");
const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const getCurrentTime = () => new Date();

// Utility function to get token expiry time (15 minutes from the current time)
const getTokenExpiry = () => {
  const expiryDurationInMinutes = 120; // Duration for token expiry in minutes
  return new Date(getCurrentTime().getTime() + expiryDurationInMinutes * 60000);
};

const getOTPExpiry = () => {
  const expiryDurationInMinutes = 10; // Duration for token expiry in minutes
  return new Date(getCurrentTime().getTime() + expiryDurationInMinutes * 60000);
};

const {
  twoFactorAuth,
} = require("../../../mailer/customer/branch/auth/twoFactorAuth");

const {
  forgetPassword,
} = require("../../../mailer/customer/branch/auth/forgetPassword");
const { getClientIpAddress } = require("../../../utils/ipAddress");

// Branch login handler
exports.login = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { username, password, admin_id, admin_token } = req.body;
  const missingFields = [];

  // Validate required fields
  if (!username || username === "") missingFields.push("Username");
  if (!password || password === "") missingFields.push("Password");

  // If there are missing fields, return an error response
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  BranchAuth.findByEmailOrMobile(username, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ status: false, message: err.message });
    }

    // If no branch or sub-user found, return a 404 response
    if (result.length === 0) {
      return res.status(404).json({
        status: false,
        message:
          "No branch or sub-user found with the provided email or mobile number",
      });
    }

    const record = result[0];
    BranchAuth.isCustomerActive(
      record.customer_id,
      (customerErr, isCustomerActive) => {
        if (customerErr) {
          console.error("Database error:", customerErr);
          return res.status(500).json({ status: false, message: customererr });
        }

        // If customer is not active, return a 404 response
        if (!isCustomerActive) {
          return res.status(404).json({
            status: false,
            message: "Parent Company is not active",
          });
        }

        // Find branch by email or mobile number
        BranchAuth.isBranchActive(record.branch_id, (err, isBranchActive) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message });
          }

          // If branch is not found or is not active, return a 404 response
          if (isBranchActive === false) {
            return res.status(404).json({
              status: false,
              message: "Branch not active",
            });
          }

          let continueValidation = false;
          if (record.type === "sub_user") {
            BranchAuth.isBranchSubUserActive(
              record.id,
              (err, isBranchSubUserActive) => {
                if (err) {
                  console.error("Database error:", err);
                  return res
                    .status(500)
                    .json({ status: false, message: err.message });
                }

                // If branch is not found or is not active, return a 404 response
                if (isBranchSubUserActive === false) {
                  return res.status(404).json({
                    status: false,
                    message: "Branch not active",
                  });
                }
                continueValidation = true;
              }
            );
          } else if (record.type === "branch") {
            continueValidation = true;
          } else {
            return res.status(401).json({
              status: false,
              message: "Undefined user trying to login",
            });
          }

          if ((continueValidation = true)) {
            // Validate password
            BranchAuth.validatePassword(
              username,
              password,
              record.type,
              (err, isValid) => {
                if (err) {
                  console.error("Database error:", err);
                  /*
                  Common.branchLoginLog(
                    ipAddress,
                    ipType,
                    record.branch_id,
                    "Sub User login",
                    "0",
                    err,
                    () => { }
                  );
                  */
                  return res
                    .status(500)
                    .json({ status: false, message: err.message });
                }

                // If the password is incorrect, log the attempt and return a 401 response
                if (!isValid) {
                  /*
                  Common.branchLoginLog(
                    ipAddress,
                    ipType,
                    record.branch_id,
                    "Sub User login",
                    "0",
                    "Incorrect password",
                    () => { }
                  );
                  */
                  return res
                    .status(401)
                    .json({ status: false, message: "Incorrect password" });
                }

                if (record.status == 0) {
                  /*
                  Common.branchLoginLog(
                    ipAddress,
                    ipType,
                    record.branch_id,
                    "login",
                    "0",
                    `Branch ${record.type === "sub_user" ? "Sub User" : ""
                    } account is not yet verified.`,
                    () => { }
                  );
                  */
                  return res.status(400).json({
                    status: false,
                    message: `Branch ${record.type === "sub_user" ? "Sub User" : ""
                      } account is not yet verified. Please complete the verification process before proceeding.`,
                  });
                }

                if (record.status == 2) {
                  /*
                  Common.branchLoginLog(
                    ipAddress,
                    ipType,
                    record.branch_id,
                    "login",
                    "0",
                    `Branch ${record.type === "sub_user" ? "Sub User" : ""
                    } account has been suspended.`,
                    () => { }
                  );
                  */
                  return res.status(400).json({
                    status: false,
                    message: `Branch ${record.type === "sub_user" ? "Sub User" : ""
                      } account has been suspended. Please contact the help desk for further assistance.`,
                  });
                }

                if (admin_id && admin_token) {
                  const action = "go_to_login";
                  AdminCommon.isAdminAuthorizedForAction(
                    admin_id,
                    action,
                    (authResult) => {
                      if (!authResult || !authResult.status) {
                        return res.status(403).json({
                          status: false,
                          err: authResult,
                          message: authResult
                            ? authResult.message
                            : "Authorization failed",
                        });
                      }

                      AdminCommon.isAdminTokenValid(
                        admin_token,
                        admin_id,
                        (err, tokenResult) => {
                          if (err) {
                            console.error("Error checking token validity:", err);
                            return res.status(500).json({
                              status: false,
                              message: "Token validation failed",
                            });
                          }

                          if (!tokenResult.status) {
                            return res.status(401).json({
                              status: false,
                              message: tokenResult.message,
                            });
                          }

                          const adminNewToken = tokenResult.newToken;

                          // Generate new token and expiry time
                          const token = generateToken();
                          const newTokenExpiry = getTokenExpiry(); // This will be an ISO string

                          // Update the token in the database
                          BranchAuth.updateToken(
                            record.id,
                            token,
                            newTokenExpiry,
                            record.type,
                            (err) => {
                              if (err) {
                                console.error("Database error:", err);
                                /*
                                Common.branchLoginLog(
                                  ipAddress,
                                  ipType,
                                  record.id,
                                  "login",
                                  "0",
                                  "Error updating token: " + err,
                                  () => { }
                                );
                                */
                                return res.status(500).json({
                                  status: false,
                                  message: `Error updating token: ${err}`,
                                  token: adminNewToken,
                                });
                              }

                              /*
                              // Log successful login and return the response
                              Common.branchLoginLog(
                                ipAddress,
                                ipType,
                                record.id,
                                "login",
                                "1",
                                null,
                                () => { }
                              );
                              */

                              const {
                                login_token,
                                token_expiry,
                                ...branchDataWithoutToken
                              } = record;

                              res.json({
                                status: true,
                                message: "Login successful",
                                branchData: branchDataWithoutToken,
                                token,
                                admin_token: adminNewToken,
                              });
                            }
                          );
                        }
                      );
                    }
                  );
                } else {
                  if (record.two_factor_enabled && record.two_factor_enabled == 1) {
                    const isMobile = /^\d{10}$/.test(username);
                    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

                    const otp = generateOTP();
                    const otpExpiry = getOTPExpiry();

                    if (isEmail) {
                      // Update the token in the database
                      BranchAuth.updateToken(
                        record.id,
                        null,
                        null,
                        record.type, (err) => {
                          if (err) {
                            /*
                            Common.branchLoginLog(
                              ipAddress,
                              ipType,
                              record.id,
                              "login",
                              "0",
                              "Error updating token: " + err,
                              () => { }
                            );
                            */
                            return res.status(500).json({
                              status: false,
                              message: `Error updating token: ${err}`,
                            });
                          }
                          BranchAuth.updateOTP(
                            record.id,
                            record.type,
                            otp,
                            otpExpiry,
                            (err, result) => {
                              if (err) {
                                return res.status(500).json({
                                  status: false,
                                  message:
                                    "Failed to update OTP. Please try again later.",
                                });
                              }

                              const toArr = [{ name: record.name, email: username }];
                              twoFactorAuth(
                                "branch auth",
                                "two-factor-auth",
                                otp,
                                record.name,
                                toArr,
                                []
                              )
                                .then(() => {
                                  return res.status(200).json({
                                    status: true,
                                    message: "OTP sent successfully.",
                                  });
                                })
                                .catch((emailError) => {
                                  return res.status(200).json({
                                    status: true,
                                    message:
                                      "OTP generated successfully, but email failed.",
                                  });
                                });
                            }
                          );
                        });
                    } else if (isMobile) {
                      return res.status(500).json({
                        status: false,
                        message:
                          "Failed to send OTP on mobile. Please try again later.",
                      });
                    } else {
                      return res.status(500).json({
                        status: false,
                        message: "unexpected method used for login",
                      });
                    }
                  } else {
                    // Generate new token and expiry time
                    const token = generateToken();
                    const newTokenExpiry = getTokenExpiry(); // This will be an ISO string

                    // Update the token in the database
                    BranchAuth.updateToken(
                      record.id,
                      token,
                      newTokenExpiry,
                      record.type,
                      (err) => {
                        if (err) {
                          console.error("Database error:", err);
                          /*
                          Common.branchLoginLog(
                            ipAddress,
                            ipType,
                            record.id,
                            "login",
                            "0",
                            "Error updating token: " + err,
                            () => { }
                          );
                          */
                          return res.status(500).json({
                            status: false,
                            message: `Error updating token: ${err}`,
                          });
                        }

                        /*
                        // Log successful login and return the response
                        Common.branchLoginLog(
                          ipAddress,
                          ipType,
                          record.id,
                          "login",
                          "1",
                          null,
                          () => { }
                        );
                        */
                        const {
                          login_token,
                          token_expiry,
                          ...branchDataWithoutToken
                        } = record;

                        res.json({
                          status: true,
                          message: "Login successful",
                          branchData: branchDataWithoutToken,
                          token,
                        });
                      }
                    );
                  }
                }
              }
            );
          }
        });
      }
    );
  });
};

exports.verifyTwoFactor = (req, res) => {
  const { username, otp } = req.body;
  const { ipAddress, ipType } = getClientIpAddress(req);
  const missingFields = [];

  // Validate required fields
  if (!username || username.trim() === "") missingFields.push("Username");
  if (!otp || otp.trim() === "") missingFields.push("OTP");

  const otpAsNumber = Number(otp); // Attempt to convert OTP to a number

  if (isNaN(otpAsNumber)) {
    return res.status(400).json({
      status: false,
      message: "OTP must be a valid number.",
    });
  }

  const otpInt = parseInt(otpAsNumber, 10);

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Find branch by email or mobile
  BranchAuth.findByEmailOrMobile(username, (err, result) => {
    if (err) {
      console.error("Error finding branch:", err);
      return res.status(500).json({
        status: false,
        message: "An internal error occurred while verifying the user.",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No branch found with the provided email or mobile number.",
      });
    }

    const branch = result[0];

    // Validate account status
    if (branch.status === 0) {
      /*
      Common.branchLoginLog(
        ipAddress,
        ipType,
        branch.id,
        "login",
        "0",
        "Account not verified",
        () => { }
      );
      */
      return res.status(400).json({
        status: false,
        message: "Branch account is not verified.",
      });
    }

    if (branch.status === 2) {
      /*
      Common.branchLoginLog(
        ipAddress,
        ipType,
        branch.id,
        "login",
        "0",
        "Account suspended",
        () => { }
      );
      */

      return res.status(400).json({
        status: false,
        message: "Branch account is suspended.",
      });
    }

    // Validate token and two-factor authentication settings
    const currentTime = getCurrentTime();
    const tokenExpiry = new Date(branch.token_expiry);

    /*
    if (branch.login_token && tokenExpiry > currentTime) {
      console.log("Another branch is currently logged in.");
      Common.branchLoginLog(
        branch.id,
        "login",
        "0",
        "Another branch is logged in",
        () => {}
      );
      return res.status(400).json({
        status: false,
        message:
          "Another branch is currently logged in. Please try again later.",
      });
    }
*/
    if (branch.two_factor_enabled !== 1) {
      return res.status(400).json({
        status: false,
        message: "Two-factor authentication is disabled for this branch.",
      });
    }

    // Validate OTP
    const otpExpiry = new Date(branch.otp_expiry);

    if (branch.otp !== otpInt) {
      /*
      Common.branchLoginLog(ipAddress,
        ipType, branch.id, "login", "0", "Invalid OTP", () => { });
      */

      return res.status(401).json({
        status: false,
        message: "The provided OTP is incorrect.",
      });
    }

    if (otpExpiry <= currentTime) {
      /*
      Common.branchLoginLog(ipAddress,
        ipType, branch.id, "login", "0", "OTP expired", () => { });
      */

      return res.status(401).json({
        status: false,
        message: "The OTP has expired. Please request a new one.",
      });
    }

    // Update token and return success response
    const token = generateToken();
    const newTokenExpiry = getTokenExpiry();

    BranchAuth.updateOTP(branch.id, branch.type, null, null, (err, result) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message: "Failed to update OTP. Please try again later.",
        });
      }
      BranchAuth.updateToken(
        branch.id,
        token,
        newTokenExpiry,
        branch.type,
        (err) => {
          if (err) {
            console.error("Error updating token:", err);
            /*
            Common.branchLoginLog(
              ipAddress,
              ipType,
              branch.id,
              "login",
              "0",
              "Error updating token",
              () => { }
            );
            */

            return res.status(500).json({
              status: false,
              message:
                "An error occurred while updating the session token. Please try again.",
            });
          }

          /*
          Common.branchLoginLog(
            ipAddress,
            ipType,
            branch.id,
            "login",
            "1",
            "Login successful",
            () => { }
          );
          */

          const {
            otp,
            two_factor_enabled,
            otp_expiry,
            login_token,
            token_expiry,
            ...branchDataWithoutSensitiveInfo
          } = branch;

          return res.json({
            status: true,
            message: "Login successful.",
            branchData: branchDataWithoutSensitiveInfo,
            token,
          });
        });
    });
  });
};

exports.updatePassword = (req, res) => {

  const { ipAddress, ipType } = getClientIpAddress(req);
  console.log(`step 1`);
  const { new_password, sub_user_id, branch_id, _token } = req.body;

  // Validate required fields
  const missingFields = [];

  if (
    !new_password ||
    new_password === "" ||
    new_password === undefined ||
    new_password === "undefined"
  ) {
    missingFields.push("New Password");
  }

  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  ) {
    console.log(`step 2`);

    missingFields.push("Branch ID");
  }

  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  ) {
    console.log(`step 3`);

    missingFields.push("Token");
  }

  // If required fields are missing, return error
  if (missingFields.length > 0) {
    console.log(`step 4`);

    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const type = sub_user_id ? 'branch_sub_users' : 'branches';

  // Validate branch token
  Common.isBranchTokenValid(
    _token,
    sub_user_id || "",
    branch_id,
    (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }
      console.log('step-222')
      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      // Check if employee ID is unique
      BranchAuth.updatePassword(new_password, branch_id, type, (err, result) => {
        if (err) {
          console.log(`step 5`);
          console.error("Database error during password update:", err);
          /*
          Common.branchActivityLog(
            ipAddress,
            ipType,
            branch_id,
            "Password",
            "Update",
            "o",
            "Branch attempted to update password",
            null,
            () => { }
          );
          */
          return res.status(500).json({
            status: false,
            message: "Failed to update password. Please try again later.",
            token: newToken,
          });
        }

        /*
        Common.branchActivityLog(
          ipAddress,
          ipType,
          branch_id,
          "Password",
          "Update",
          "1",
          "Branch successfully updated password",
          null,
          () => { }
        );
        */

        return res.status(200).json({
          status: true,
          message: "Password updated successfully.",
          data: result,
          token: newToken,
        });
      });
    }
  );
};

// Branch logout handler
exports.logout = (req, res) => {
  const { sub_user_id, branch_id, _token } = req.query;

  // Validate required fields and create a custom message
  let missingFields = [];
  if (!branch_id || branch_id === "") missingFields.push("Branch ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Validate the branch token
  Common.isBranchTokenValid(
    _token,
    sub_user_id || "",
    branch_id,
    (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      // Update the token in the database to null
      BranchAuth.logout(sub_user_id, branch_id, (err) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: `Error logging out: ${err}`,
          });
        }

        res.json({
          status: true,
          message: "Logout successful",
        });
      });
    }
  );
};

// Branch login validation handler
exports.validateLogin = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { sub_user_id, branch_id, _token } = req.body;
  const missingFields = [];
  // Validate required fields
  if (!branch_id) {
    missingFields.push("Branch Id");
  }

  if (!_token) {
    missingFields.push("Token");
  }

  // If there are missing fields, return an error response
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Fetch branch by ID
  BranchAuth.findById(sub_user_id || "", branch_id, (err, branch) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ status: false, message: err });
    }

    // If no branch found, return a 404 response
    if (!branch) {
      return res.status(404).json({
        status: false,
        message: "Branch not found with the provided ID",
      });
    }

    // Validate the token
    if (branch.login_token !== _token) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid or expired token" });
    }

    // Check branch status
    if (branch.status === 0) {
      /*
      Common.branchLoginLog(
        ipAddress,
        ipType,
        branch.id,
        "login",
        "0",
        "Branch account is not yet verified.",
        () => { }
      );
      */

      return res.status(400).json({
        status: false,
        message:
          "Branch account is not yet verified. Please complete the verification process before proceeding.",
      });
    }

    if (branch.status === 2) {
      /*
      Common.branchLoginLog(
        ipAddress,
        ipType,
        branch.id,
        "login",
        "0",
        "branch account has been suspended.",
        () => { }
      );
      */

      return res.status(400).json({
        status: false,
        message:
          "Branch account has been suspended. Please contact the help desk for further assistance.",
      });
    }

    // Check if the existing token is still valid
    Common.isBranchTokenValid(
      _token,
      sub_user_id || "",
      branch_id,
      (err, result) => {
        if (err) {
          console.error("Error checking token validity:", err);
          return res.status(500).json({ status: false, message: err.message });
        }

        if (!result.status) {
          return res
            .status(401)
            .json({ status: false, message: result.message });
        }

        const newToken = result.newToken;

        // Here you can respond with success and the new token if applicable
        return res.status(200).json({
          status: true,
          message: "Login verified successful",
          token: newToken,
        });
      }
    );
  });
};

exports.forgotPasswordRequest = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { email } = req.body;

  // Validate the input email
  if (!email || email.trim() === "") {
    return res.status(400).json({
      status: false,
      message: "Email is required.",
    });
  }

  // Check if an branch exists with the provided email
  BranchAuth.findByEmailOrMobileAllInfo(email, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: err.message,
      });
    }

    // If no branch found, return a 404 response
    if (result.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No branch found with the provided email.",
      });
    }

    const branch = result[0];

    console.log(`branch - `, branch);

    // Retrieve application information for the reset link
    AppModel.appInfo("frontend", (err, appInfo) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message:
            "An error occurred while retrieving application information. Please try again.",
        });
      }

      if (appInfo) {
        const token = generateToken();
        const tokenExpiry = getTokenExpiry(); // ISO string for expiry time

        // Update the reset password token in the database
        BranchAuth.setResetPasswordToken(
          branch.id,
          branch.type,
          token,
          tokenExpiry,
          (err) => {
            if (err) {
              console.error("Error updating reset password token:", err);
              /*
              Common.branchLoginLog(
                ipAddress,
                ipType,
                branch.id,
                "forgot-password",
                "0",
                `Error updating token: ${err}`,
                () => { }
              );
              */
              return res.status(500).json({
                status: false,
                message:
                  "An error occurred while generating the reset password token. Please try again.",
              });
            }

            // Send password reset email
            const resetLink = `${appInfo.host || "www.screeningstar.in"
              }/branch/reset-password?email=${branch.email}&token=${token}`;
            const toArr = [{ name: branch.name || branch.email, email: branch.email }];


            const ccArr = [
              { name: 'BGV Team', email: 'bgv@screeningstar.com' }
            ];

            forgetPassword(
              "branch auth",
              "forget-password",
              branch.name || branch.email,
              resetLink,
              toArr,
              ccArr
            )
              .then(() => {
                /*
                Common.branchLoginLog(
                  ipAddress,
                  ipType,
                  branch.id,
                  "forgot-password",
                  "1",
                  null,
                  () => { }
                );
                */
                return res.status(200).json({
                  status: true,
                  message: `A password reset email has been successfully sent to ${branch.name}.`,
                });
              })
              .catch((emailError) => {
                console.error(
                  "Error sending password reset email:",
                  emailError
                );
                /*
                Common.branchLoginLog(
                  ipAddress,
                  ipType,
                  branch.id,
                  "forgot-password",
                  "0",
                  `Failed to send email: ${emailError.message}`,
                  () => { }
                );
                */
                return res.status(500).json({
                  status: false,
                  message: `Failed to send password reset email to ${branch.name}. Please try again later.`,
                });
              });
          }
        );
      } else {
        return res.status(500).json({
          status: false,
          message:
            "Application information is not available. Please try again later.",
        });
      }
    });
  });
};

exports.forgotPassword = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { new_password, email, password_token } = req.body;
  const missingFields = [];

  // Validate required fields
  if (!new_password || new_password.trim() === "") {
    missingFields.push("New Password");
  }
  if (!email || email.trim() === "") {
    missingFields.push("Email");
  }
  if (!password_token || password_token.trim() === "") {
    missingFields.push("Password Token");
  }

  // Return error if there are missing fields
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Fetch branch details using the provided email
  BranchAuth.findByEmailOrMobileAllInfo(email, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ status: false, message: "Internal server error." });
    }

    // Return error if no branch found
    if (!result || result.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No branch found with the provided email.",
      });
    }

    const branch = result[0];
    console.log(`branch - `, branch);
    const tokenExpiry = new Date(branch.password_token_expiry);
    const currentTime = new Date();

    // Check if the token is still valid
    if (currentTime > tokenExpiry) {
      return res.status(401).json({
        status: false,
        message: "Password reset token has expired. Please request a new one.",
      });
    }

    console.log(`1 - `, branch.reset_password_token);
    console.log(`2 - `, password_token);
    // Verify if the token matches
    if (branch.reset_password_token !== password_token) {
      return res.status(401).json({
        status: false,
        message: "Invalid password reset token.",
      });
    }

    // Proceed to update the password
    BranchAuth.updatePassword(new_password, branch.id, branch.type, (err, result) => {
      if (err) {
        console.error("Database error during password update:", err);
        /*
        Common.branchActivityLog(
          ipAddress,
          ipType,
          branch.id,
          "Password",
          "Update",
          "0",
          "Failed password update attempt",
          err,
          () => { }
        );
        */
        console.log(`step 7`);

        return res.status(500).json({
          status: false,
          message: "Failed to update password. Please try again later.",
        });
      }

      /*
      // Log successful password update
      Common.branchActivityLog(
        ipAddress,
        ipType,
        branch.id,
        "Password",
        "Update",
        "1",
        "Branch password updated successfully",
        null,
        () => { }
      );
      */

      return res.status(200).json({
        status: true,
        message: "Password updated successfully.",
      });
    });
  });
};
