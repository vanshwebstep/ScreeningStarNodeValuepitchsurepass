const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
function generateTicketNumber() {
  const prefix = "TCK";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // Format: YYYYMMDD
  const uniqueId = String(Math.floor(Math.random() * 1000000)).padStart(6, "0"); // Random 6-digit number
  return `${prefix}-${date}-${uniqueId}`;
}

const Branch = {
  list: async (callback) => {
    const sql = `
                SELECT 
          T.id, 
          T.ticket_number, 
          T.title, 
          T.created_at,
          T.branch_id,
          T.remarks,
          T.status,
          B.name AS branch_name,
          C.id AS customer_id,
          C.name AS customer_name,
          C.client_unique_id
        FROM \`tickets\` AS T
        INNER JOIN \`branches\` AS B ON B.id = T.branch_id
        INNER JOIN \`customers\` AS C ON C.id = T.customer_id
        WHERE C.is_deleted != 1
        ORDER BY T.\`created_at\` ASC
      `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    const hierarchicalData = results.reduce((acc, row) => {
      // Create or get the customer
      if (!acc[row.customer_id]) {
        acc[row.customer_id] = {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          client_unique_id: row.client_unique_id,
          branches: [],
        };
      }

      // Check if the branch already exists
      let branch = acc[row.customer_id].branches.find(
        (b) => b.branch_id === row.branch_id
      );

      if (!branch) {
        branch = {
          branch_name: row.branch_name,
          branch_id: row.branch_id,
          tickets: [],
        };
        acc[row.customer_id].branches.push(branch);
      }

      // Add the ticket to the branch's tickets list
      branch.tickets.push({
        ticket_id: row.id,
        ticket_number: row.ticket_number,
        title: row.title,
        remarks: row.remarks,
        status: row.status,
        created_at: row.created_at,
      });

      return acc;
    }, {});

    // Convert the object to an array
    const formattedResults = Object.values(hierarchicalData);

    callback(null, formattedResults);


  },

  getTicketDataByTicketNumber: async (ticketNumber, callback) => {
    const sql = `SELECT id, title, remarks, status, created_at FROM \`tickets\` WHERE \`ticket_number\` = ? LIMIT 1`;
    const ticketResults = await sequelize.query(sql, {
      replacements: [ticketNumber], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (ticketResults.length === 0) {
      return callback({ message: "Ticket not found" }, null);
    }
    const ticketData = ticketResults[0];
    const conversationsSql = `SELECT id, \`from\`, message, created_at FROM \`ticket_conversations\` WHERE ticket_id = ?`;
    const conversationResults = await sequelize.query(conversationsSql, {
      replacements: [ticketData.id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, {
      ticket: ticketData,
      conversations: conversationResults,
    });

  },

  getTicketByTicketNumber:async (ticketNumber, callback) => {

  
      const sql = `SELECT id, title, remarks, status, created_at FROM \`tickets\` WHERE \`ticket_number\` = ? LIMIT 1`;

      const ticketResults = await sequelize.query(sql, {
      replacements: [ticketNumber], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

        if (ticketResults.length === 0) {
          return callback({ message: "Ticket not found" }, null);
        }
        const ticketData = ticketResults[0];
        callback(null, ticketData);
 
  },

  chat: async (ticketData, callback) => {
    if (!ticketData || !ticketData.ticket_number) {
        return callback({ message: "Invalid ticket data. Ticket number is required." }, null);
    }

    console.log("ticketData:", ticketData);

    const sqlTicket = `
      SELECT id, branch_id, customer_id, title, description, created_at
      FROM \`tickets\` WHERE \`ticket_number\` = ? LIMIT 1
    `;

    try {
        const ticketResults = await sequelize.query(sqlTicket, {
            replacements: [ticketData.ticket_number],
            type: QueryTypes.SELECT,
        });

        if (ticketResults.length === 0) {
            return callback({ message: "Ticket not found" }, null);
        }

        const ticket = ticketResults[0];

        const branchSql = `SELECT id, name, email FROM \`branches\` WHERE \`id\` = ? LIMIT 1`;
        const branchResults = await sequelize.query(branchSql, {
            replacements: [ticket.branch_id],
            type: QueryTypes.SELECT,
        });
console.log('branchResults--',branchResults)
        if (branchResults.length === 0) {
            return callback({ message: "Branch not found" }, null);
        }

        const customerSql = `SELECT id, name, emails FROM \`customers\` WHERE \`id\` = ? AND is_deleted != 1 LIMIT 1`;
        const customerResults = await sequelize.query(customerSql, {
            replacements: [ticket.customer_id],
            type: QueryTypes.SELECT,
        });

        if (customerResults.length === 0) {
            return callback({ message: "Customer not found" }, null);
        }

        if (!ticketData.message) {
            return callback({ message: "Message cannot be empty" }, null);
        }

        const sqlInsertConversation = `
            INSERT INTO \`ticket_conversations\` (branch_id, admin_id, customer_id, ticket_id, \`from\`, message)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const conversationValues = [
            ticket.branch_id,
            ticketData.admin_id,
            ticket.customer_id,
            ticket.id,
            "admin",
            ticketData.message,
        ];

        const conversationResults = await sequelize.query(sqlInsertConversation, {
            replacements: conversationValues,
            type: QueryTypes.INSERT,
        });

        const conversationId = conversationResults[0];
        console.log('conversationResults--',conversationResults)
        if (!conversationId) {
            return callback({ message: "Failed to insert conversation" }, null);
        }

        const sqlGetCreatedAt = `SELECT \`created_at\` FROM \`ticket_conversations\` WHERE \`id\` = ?`;

        const result = await sequelize.query(sqlGetCreatedAt, {
            replacements: [conversationId],
            type: QueryTypes.SELECT,
        });

        return callback(null, {
            title: ticket.title,
            description: ticket.description,
            created_at: result[0]?.created_at || null,
            branch_name: branchResults[0].name,
            branch_email: branchResults[0].email,
            customer_name: customerResults[0].name,
            customer_emails: customerResults[0].emails,
        });

    } catch (error) {
        console.error("Database error:", error);
        return callback({ message: "Database error", error }, null);
    }
},

  update: async (ticket_number, remarks, status, callback) => {

    const sql = `
      UPDATE \`tickets\`
      SET \`remarks\` = ?, \`status\` = ?
      WHERE \`ticket_number\` = ?
    `;
     
      const results = await sequelize.query(sql, {
        replacements: [remarks, status, ticket_number], // Positional replacements using ?
        type: QueryTypes.UPDATE,
      });

      callback(null, results);


    },   

      delete: async (ticket_number, callback) => {
          const sql = `SELECT id FROM \`tickets\` WHERE \`ticket_number\` = ? LIMIT 1`;

          const ticketResults = await sequelize.query(sql, {
            replacements: [ticket_number], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
        
            if (ticketResults.length === 0) {
              return callback({ message: "Ticket not found" }, null);
            }

            const ticketQryData = ticketResults[0];

            const deleteConversationsSql = `DELETE FROM \`ticket_conversations\` WHERE \`ticket_id\` = ?`;
            const deleteConversationsResults = await sequelize.query(deleteConversationsSql, {
              replacements: [ticketQryData.id], // Positional replacements using ?
              type: QueryTypes.DELETE,
            });
            
                const deleteTicketSql = `DELETE FROM \`tickets\` WHERE \`id\` = ?`;
                const deleteTicketResults = await sequelize.query(deleteTicketSql, {
                  replacements: [ticketQryData.id], // Positional replacements using ?
                  type: QueryTypes.DELETE,
                });
                    callback(null, deleteTicketResults);
 
      },
};

  module.exports = Branch;
