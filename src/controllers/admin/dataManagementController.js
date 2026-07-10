const Admin = require("../../models/admin/adminModel");
const DataManagement = require("../../models/admin/dataManagementModel");
const crypto = require("crypto");
const Customer = require("../../models/customer/customerModel");
const ClientApplication = require("../../models/customer/branch/clientApplicationModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

const DATA_MANAGEMENT_ALLOWED_KEYS = [
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

function flattenJsonWithAnnexure(jsonObj) {
  let result = {};
  let annexureResult = {};

  function recursiveFlatten(obj, isAnnexure = false) {
    if (!obj || typeof obj !== "object") return;

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

function buildDataManagementJson(updatedJson = {}, record = {}) {
  const { mainJsonRaw } = flattenJsonWithAnnexure(updatedJson);
  [
    "client_organization_name",
    "client_organization_code",
    "client_applicant_name",
    "client_applicant_gender",
  ].forEach((key) => {
    if (
      (mainJsonRaw[key] === undefined ||
        mainJsonRaw[key] === null ||
        mainJsonRaw[key] === "") &&
      record[key] !== undefined &&
      record[key] !== null &&
      record[key] !== ""
    ) {
      mainJsonRaw[key] = record[key];
    }
  });

  return Object.keys(mainJsonRaw)
    .filter((key) => DATA_MANAGEMENT_ALLOWED_KEYS.includes(key))
    .reduce((obj, key) => {
      obj[key] = mainJsonRaw[key];
      return obj;
    }, {});
}

function callModel(method, ...args) {
  return new Promise((resolve, reject) => {
    method(...args, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

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
                                    "doi",
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

exports.importClientData = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);
  const { admin_id, _token, import_name, records } = req.body;

  const missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      status: false,
      message: "records must be a non-empty array.",
    });
  }

  const action = "data_management";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (AuthResult) => {
    if (!AuthResult.status) {
      return res.status(403).json({
        status: false,
        message: "You are not authorized to perform this action.",
      });
    }

    AdminCommon.isAdminTokenValid(_token, admin_id, async (err, TokenResult) => {
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
      let importLogId = null;
      const rowResults = [];

      try {
        const importLog = await callModel(
          DataManagement.createClientDataImportLog,
          {
            admin_id,
            import_name: import_name || null,
            raw_json: {
              import_name: import_name || null,
              records,
            },
            status: "processing",
            summary_json: null,
          }
        );
        importLogId = importLog.insertId;
      } catch (logErr) {
        console.error("Import log create error:", logErr);
        return res.status(500).json({
          status: false,
          message: "Unable to create import log. Please try again.",
          token: newToken,
        });
      }

      for (let index = 0; index < records.length; index++) {
        const rowNumber = index + 1;
        const record = records[index];

        if (!record || typeof record !== "object" || Array.isArray(record)) {
          rowResults.push({
            row: rowNumber,
            status: "failed",
            message: "Record must be a JSON object.",
          });
          continue;
        }

        const clientApplicationCode =
          record.client_application_id ||
          record.application_id ||
          record.clientApplicationId;

        if (!clientApplicationCode || clientApplicationCode === "") {
          rowResults.push({
            row: rowNumber,
            status: "failed",
            message: "client_application_id is required.",
          });
          continue;
        }

        if (
          !record.updated_json ||
          typeof record.updated_json !== "object" ||
          Array.isArray(record.updated_json)
        ) {
          rowResults.push({
            row: rowNumber,
            client_application_id: clientApplicationCode,
            status: "failed",
            message: "updated_json must be a JSON object.",
          });
          continue;
        }

        try {
          const application = await callModel(
            DataManagement.findClientApplicationForImport,
            clientApplicationCode
          );

          if (!application) {
            rowResults.push({
              row: rowNumber,
              client_application_id: clientApplicationCode,
              status: "failed",
              message: "Client application id not found.",
            });
            continue;
          }

          const mainJson = buildDataManagementJson(record.updated_json, record);

          if (Object.keys(mainJson).length === 0) {
            rowResults.push({
              row: rowNumber,
              client_application_id: clientApplicationCode,
              application_id: application.id,
              status: "failed",
              message: "No valid data-management fields found in updated_json.",
            });
            continue;
          }

          const clientUpdateData = {};
          if (record.client_applicant_name) {
            clientUpdateData.name = record.client_applicant_name;
          }
          if (record.client_applicant_gender) {
            clientUpdateData.gender = record.client_applicant_gender;
          }

          if (Object.keys(clientUpdateData).length > 0) {
            await callModel(
              ClientApplication.updateByData,
              clientUpdateData,
              application.id
            );
          }

          const basicEntry =
            record.basic_entry === undefined || record.basic_entry === null
              ? "1"
              : record.basic_entry;
          const dataQc =
            record.data_qc === undefined || record.data_qc === null
              ? "0"
              : record.data_qc;

          await callModel(DataManagement.updateBasicEntry, {
            application_id: application.id,
            basic_entry: basicEntry,
          });
          await callModel(DataManagement.updateDataQC, {
            application_id: application.id,
            data_qc: dataQc,
          });
          await callModel(
            DataManagement.submit,
            mainJson,
            application.id,
            application.branch_id,
            application.customer_id
          );

          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "Data Management Import",
            "import",
            "1",
            JSON.stringify({
              client_application_id: clientApplicationCode,
              application_id: application.id,
              imported_fields: Object.keys(mainJson),
            }),
            null,
            () => { }
          );

          rowResults.push({
            row: rowNumber,
            client_application_id: clientApplicationCode,
            application_id: application.id,
            status: "success",
            message: "Data management values saved.",
          });
        } catch (rowErr) {
          console.error("Import row error:", rowErr);
          rowResults.push({
            row: rowNumber,
            client_application_id: clientApplicationCode,
            status: "failed",
            message: rowErr.message || "Failed to import this record.",
          });
        }
      }

      const imported = rowResults.filter((row) => row.status === "success").length;
      const failed = rowResults.length - imported;
      const summary = {
        total: rowResults.length,
        imported,
        failed,
      };

      try {
        await callModel(DataManagement.updateClientDataImportLog, importLogId, {
          status: failed > 0 ? "completed_with_errors" : "completed",
          summary_json: {
            ...summary,
            results: rowResults,
          },
        });
      } catch (logErr) {
        console.error("Import log update error:", logErr);
      }

      return res.status(failed === rowResults.length ? 422 : 200).json({
        status: imported > 0,
        message:
          failed > 0
            ? "Import completed with some failed records."
            : "Import completed successfully.",
        import_id: importLogId,
        summary,
        results: rowResults,
        token: newToken,
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
