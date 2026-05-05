const Admin = require("../../models/admin/adminModel");
const DataManagement = require("../../models/admin/dataManagementModel");
const crypto = require("crypto");
const Customer = require("../../models/customer/customerModel");
const ClientApplication = require("../../models/customer/branch/clientApplicationModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to list all customers
exports.list = (req, res) => {
  const { admin_id, _token, filter_status } = req.query;

  // Check for missing fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  // Return error if there are missing fields
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Action for admin authorization
  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        err: authResult,
        message: authResult.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res
          .status(500)
          .json({ status: false, err, message: err.message });
      }

      if (!tokenResult.status) {
        return res.status(401).json({
          status: false,
          err: tokenResult,
          message: tokenResult.message,
        });
      }

      const newToken = tokenResult.newToken;

      // Fetch customer list with filter status
      DataManagement.list(filter_status, (err, customerResults) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            err,
            message: err.message,
            token: newToken,
          });
        }

        // Respond with the fetched customer data
        return res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: customerResults,
          totalResults: customerResults.length,
          token: newToken,
        });
      });
    });
  });
};

exports.listByCustomerId = (req, res) => {
  const { customer_id, filter_status, admin_id, _token } = req.query;

  let missingFields = [];
  if (!customer_id || customer_id === "") missingFields.push("Customer ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        err: result,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res
          .status(500)
          .json({ status: false, err, message: err.message });
      }

      if (!result.status) {
        return res
          .status(401)
          .json({ status: false, err: result, message: result.message });
      }

      const newToken = result.newToken;

      DataManagement.listByCustomerID(
        customer_id,
        filter_status,
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Branches tracker fetched successfully",
            customers: result,
            totalResults: result.length,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.applicationListByBranch = (req, res) => {
  const { filter_status, branch_id, admin_id, _token, status } = req.query;

  let missingFields = [];
  if (!branch_id || branch_id === "" || branch_id === undefined || branch_id === "undefined")
    missingFields.push("Branch ID");
  if (!admin_id || admin_id === "" || admin_id === undefined || admin_id === "undefined")
    missingFields.push("Admin ID");
  if (!_token || _token === "" || _token === undefined || _token === "undefined")
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        err: result,
        message: result.message,
      });
    }

    Branch.getBranchById(branch_id, (err, currentBranch) => {
      if (err) {
        console.error("Database error during branch retrieval:", err);
        return res.status(500).json({
          status: false,
          message: "Failed to retrieve Branch. Please try again.",
        });
      }

      if (!currentBranch) {
        return res.status(404).json({
          status: false,
          message: "Branch not found.",
        });
      }

      AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
        if (err) {
          console.error("Error checking token validity:", err);
          return res.status(500).json({ status: false, err, message: err.message });
        }

        if (!result.status) {
          return res.status(401).json({ status: false, err: result, message: result.message });
        }

        const newToken = result.newToken;

        const statusValue = status && status !== "undefined" ? status : null;

        DataManagement.applicationListByBranch(filter_status, branch_id, statusValue, (err, result) => {
          if (err) {
            console.error("Database error while fetching applications:", err);
            return res.status(500).json({
              status: false,
              err,
              message: err.message,
              token: newToken,
            });
          }

          res.json({
            status: true,
            message: "Branches tracker fetched successfully",
            parentName: currentBranch.name,
            customers: result,
            totalResults: result.length,
            token: newToken,
          });
        });
      });
    });
  });
};

exports.applicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  )
    missingFields.push("Branch ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      DataManagement.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }
          DataManagement.getCMTApplicationById(
            application_id,
            (err, CMTApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              Branch.getBranchById(branch_id, (err, currentBranch) => {
                if (err) {
                  console.error("Database error during branch retrieval:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Branch. Please try again.",
                    token: newToken,
                  });
                }

                if (!currentBranch) {
                  return res.status(404).json({
                    status: false,
                    message: "Branch not found.",
                    token: newToken,
                  });
                }

                Customer.getCustomerById(
                  parseInt(currentBranch.customer_id),
                  (err, currentCustomer) => {
                    if (err) {
                      console.error(
                        "Database error during customer retrieval:",
                        err
                      );
                      return res.status(500).json({
                        status: false,
                        message:
                          "Failed to retrieve Customer. Please try again.",
                        token: newToken,
                      });
                    }

                    if (!currentCustomer) {
                      return res.status(404).json({
                        status: false,
                        message: "Customer not found.",
                        token: newToken,
                      });
                    }

                    Admin.list((err, admins) => {
                      if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({
                          status: false,
                          err,
                          message: err.message,
                          token: newToken,
                        });
                      }


                      if (!CMTApplicationData) {
                        return res.json({
                          status: true,
                          message: "Application fetched successfully 1",
                          application,
                          branchInfo: currentBranch,
                          customerInfo: currentCustomer,
                          admins,
                          token: newToken,
                        });
                      } else {
                        return res.json({
                          status: true,
                          message: "Application fetched successfully 2",
                          application,
                          CMTData: CMTApplicationData,
                          branchInfo: currentBranch,
                          customerInfo: currentCustomer,
                          admins,
                          token: newToken,
                        });
                      }
                    });
                  }
                );
              });
            }
          );
        }
      );
    });
  });
};

const addCaseToCrimescan = async (payload, apiKey) => {
  try {
    const response = await axios.post(
      "https://prod.crimescan.ai/v1/verify_manual_api/api/tasks/addCases",
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Add Case API Error:", error.message);
    throw error;
  }
};
exports.submit = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const {
    admin_id,
    _token,
    client_applicant_gender,
    client_applicant_name,
    client_organization_name,
    client_organization_code,
    branch_id,
    customer_id,
    application_id,
    updated_json,
    basic_entry,
    data_qc,
    send_mail,
  } = req.body;

  // Required fields validation
  const requiredFields = {
    admin_id,
    _token,
    client_applicant_gender,
    client_applicant_name,
    client_organization_name,
    client_organization_code,
    branch_id,
    customer_id,
    application_id,
    updated_json,
    data_qc,
    basic_entry
  };

  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field] || requiredFields[field] === "")
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following fields are missing or invalid: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  // Flatten JSON and separate annexure
  function flattenJsonWithAnnexure(jsonObj) {
    let result = {};
    let annexureResult = {};

    function recursiveFlatten(obj, isAnnexure = false) {
      for (let key in obj) {
        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          if (key === "annexure") {
            isAnnexure = true;
            annexureResult = {};
          }
          recursiveFlatten(obj[key], isAnnexure);
          if (isAnnexure && key !== "annexure") {
            annexureResult[key] = obj[key];
          }
        } else {
          if (!isAnnexure) result[key] = obj[key];
        }
      }
    }

    recursiveFlatten(jsonObj);
    return { mainJsonRaw: result, annexureRawJson: annexureResult };
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    if (!AuthResult.status) {
      return res.status(403).json({
        status: false,
        message: "You are not authorized to perform this action.",
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, (err, TokenResult) => {
      if (err) {
        console.error("Error verifying token:", err);
        return res.status(500).json({
          status: false,
          message:
            "An error occurred while verifying the token. Please try again later.",
        });
      }

      if (!TokenResult.status) {
        return res.status(401).json({
          status: false,
          message: TokenResult.message,
        });
      }

      const newToken = TokenResult.newToken;
      Branch.getBranchById(branch_id, (err, currentBranch) => {
        if (err) {
          console.error("Branch retrieval error:", err);
          return res.status(500).json({
            status: false,
            message: "Unable to retrieve branch details. Please try again.",
            token: newToken,
          });
        }

        if (!currentBranch) {
          return res.status(404).json({
            status: false,
            message: "Branch not found.",
            token: newToken,
          });
        }

        if (parseInt(currentBranch.customer_id) !== parseInt(customer_id)) {
          return res.status(404).json({
            status: false,
            message: "Branch does not match the provided customer.",
            token: newToken,
          });
        }

        Customer.getCustomerById(customer_id, (err, currentCustomer) => {
          if (err) {
            console.error("Customer retrieval error:", err);
            return res.status(500).json({
              status: false,
              message: "Unable to retrieve customer details. Please try again.",
              token: newToken,
            });
          }

          if (!currentCustomer) {
            return res.status(404).json({
              status: false,
              message: "Customer not found.",
              token: newToken,
            });
          }

          Customer.checkUniqueIdForUpdate(
            customer_id,
            client_organization_code,
            (err, exists) => {
              if (err) {
                console.error("Error checking unique ID:", err);
                return res.status(500).json({
                  status: false,
                  message: "Internal server error",
                  token: newToken,
                });
              }

              if (exists) {
                return res.status(400).json({
                  status: false,
                  message: `Client Unique ID '${client_unique_id}' already exists.`,
                  token: newToken,
                });
              }

              Customer.updateByData(
                {
                  name: client_organization_name,
                  client_unique_id: client_organization_code
                },
                customer_id,
                (err, customerUpdateByData) => {
                  console.log(`Step 4`);

                  if (err) {
                    console.error(
                      "Database error during CMT Application retrieval:",
                      err
                    );
                    return res.status(500).json({
                      status: false,
                      message:
                        "Failed to retrieve CMT Application. Please try again.",
                      token: newToken,
                    });
                  }
                  console.log(`Step 3`);


                  DataManagement.getCMTApplicationById(
                    application_id,
                    (err, currentCMTApplication) => {
                      if (err) {
                        console.error("Application retrieval error:", err);
                        return res.status(500).json({
                          status: false,
                          message:
                            "Unable to retrieve application data. Please try again.",
                          token: newToken,
                        });
                      }

                      ClientApplication.updateByData(
                        {
                          name: client_applicant_name,
                          gender: client_applicant_gender
                        },
                        application_id,
                        (err, applicationClientApplication) => {
                          console.log(`Step 4`);

                          if (err) {
                            console.error(
                              "Database error during CMT Application retrieval:",
                              err
                            );
                            return res.status(500).json({
                              status: false,
                              message:
                                "Failed to retrieve CMT Application. Please try again.",
                              token: newToken,
                            });
                          }

                          DataManagement.updateBasicEntry(
                            { application_id, basic_entry },
                            (err, result) => {
                              if (err) {
                                console.error("Error updating data QC:", err);
                                return res.status(500).json({
                                  status: false,
                                  message:
                                    "An error occurred while updating data QC. Please try again.",
                                  token: newToken,
                                });
                              }
                              DataManagement.updateDataQC(
                                { application_id, data_qc },
                                (err, result) => {
                                  if (err) {
                                    console.error("Error updating data QC:", err);
                                    return res.status(500).json({
                                      status: false,
                                      message:
                                        "An error occurred while updating data QC. Please try again.",
                                      token: newToken,
                                    });
                                  }

                                  const { mainJsonRaw, annexureRawJson } =
                                    flattenJsonWithAnnexure(updated_json);

                                  const allowedKeys = [
                                    "month_year",
                                    "initiation_date",
                                    "client_organization_name",
                                    "verification_purpose",
                                    "employee_id",
                                    "client_organization_code",
                                    "client_applicant_name",
                                    "contact_number",
                                    "contact_number2",
                                    "father_name",
                                    "dob",
                                    "client_applicant_gender",
                                    "marital_status",
                                    "address",
                                    "landmark",
                                    "residence_mobile_number",
                                    "state",
                                    "permanent_address",
                                    "permanent_sender_name",
                                    "permanent_receiver_name",
                                    "permanent_landmark",
                                    "permanent_pin_code",
                                    "permanent_state",
                                    "spouse_name",
                                    "Nationality",
                                    "QC_Date",
                                    "QC_Analyst_Name",
                                    "Data_Entry_Analyst_Name",
                                    "Date_of_Data",
                                    "insuff",
                                    "address_house_no",
                                    "address_floor",
                                    "address_cross",
                                    "address_street",
                                    "address_main",
                                    "address_area",
                                    "address_locality",
                                    "address_city",
                                    "address_landmark",
                                    "address_taluk",
                                    "address_district",
                                    "address_state",
                                    "address_pin_code",
                                    "permanent_address_house_no",
                                    "permanent_address_floor",
                                    "permanent_address_cross",
                                    "permanent_address_street",
                                    "permanent_address_main",
                                    "permanent_address_area",
                                    "permanent_address_locality",
                                    "permanent_address_city",
                                    "permanent_address_landmark",
                                    "permanent_address_taluk",
                                    "permanent_address_district",
                                    "permanent_address_state",
                                    "permanent_address_pin_code",
                                  ];

                                  const requiredKeys = [
                                    "month_year",
                                    "verification_purpose",
                                    "client_applicant_name",
                                  ];

                                  const mainJson = Object.keys(mainJsonRaw)
                                    .filter((key) => allowedKeys.includes(key))
                                    .reduce((obj, key) => {
                                      obj[key] = mainJsonRaw[key];
                                      return obj;
                                    }, {});

                                  /*
                                // Check if the required keys are all filled
                                const hasEmptyRequiredFields = requiredKeys.some(
                                  (key) => !mainJson[key] || mainJson[key] === ""
                                );
                
                                if (hasEmptyRequiredFields) {
                                  return res.status(400).json({
                                    status: false,
                                    message: "Please ensure required fields are filled.",
                                    token: newToken,
                                  });
                                }
                                  */

                                  const changes = {};
                                  let logStatus = "create";

                                  if (
                                    currentCMTApplication &&
                                    Object.keys(currentCMTApplication).length > 0
                                  ) {
                                    logStatus = "update";
                                    Object.keys(mainJson).forEach((key) => {
                                      if (currentCMTApplication[key] !== mainJson[key]) {
                                        changes[key] = {
                                          old: currentCMTApplication[key],
                                          new: mainJson[key],
                                        };
                                      }
                                    });
                                  }

                                  DataManagement.submit(
                                    mainJson,
                                    application_id,
                                    branch_id,
                                    customer_id,
                                    (err, cmtResult) => {
                                      if (err) {
                                        console.error("Error updating application data:", err);
                                        return res.status(500).json({
                                          status: false,
                                          message:
                                            "Failed to process the application. Please try again later.",
                                          token: newToken,
                                        });
                                      }

                                      AdminCommon.adminActivityLog(
                                        ipAddress,
                                        ipType,
                                        admin_id,
                                        "Data Management",
                                        logStatus,
                                        "1",
                                        JSON.stringify({ application_id, ...changes }),
                                        err,
                                        () => { }
                                      );

                                      /*
                                      return res.status(200).json({
                                        status: true,
                                        message: `Application ${logStatus === "update" ? "updated" : "created"
                                          } successfully.`,
                                        token: newToken,
                                      });
                                      */

                                      return res.status(200).json({
                                        status: true,
                                        message: data_qc == 1 ? `QC Successfully Cleared` : `Basic Entry Updated Successfully.`,
                                        token: newToken,
                                      });
                                    }
                                  );
                                }
                              );
                            });
                        });
                    }
                  );
                });
            });
        });
      });
    });
  });
};

exports.customerBasicInfoWithAdminAuth = (req, res) => {
  const { customer_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !customer_id ||
    customer_id === "" ||
    customer_id === undefined ||
    customer_id === "undefined"
  )
    missingFields.push("Customer ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      Customer.infoByID(customer_id, (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        res.json({
          status: true,
          message: "Customer Info fetched successfully",
          customers: result,
          token: newToken,
        });
      });
    });
  });
};
