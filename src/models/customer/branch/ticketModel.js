const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

function generateTicketNumber() {
  const prefix = "TCK";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // Format: YYYYMMDD
  const uniqueId = String(Math.floor(Math.random() * 1000000)).padStart(6, "0"); // Random 6-digit number
  return `${prefix}-${date}-${uniqueId}`;
}

const Branch = {
  create: async (ticketData, callback) => {
    const ticketNumber = generateTicketNumber(); // Ensure this function generates a unique ticket number
    const sqlInsertTicket = `
        INSERT INTO \`tickets\` (
          \`branch_id\`, \`customer_id\`, \`ticket_number\`, \`title\`, \`description\`
        ) VALUES (?, ?, ?, ?, ?)
      `;
    const ticketValues = [
      ticketData.branch_id,
      ticketData.customer_id,
      ticketNumber,
      ticketData.title,
      ticketData.description,
    ];
    const ticketResults = await sequelize.query(sqlInsertTicket, {
      replacements: ticketValues, // Positional replacements using ?
      type: QueryTypes.INSERT,
    });

    const ticketId = ticketResults.insertId;
    callback(null, { ticketNumber, ticketId });


  },

  list: async (branch_id, callback) => {
    const sql = `SELECT id, ticket_number, title, created_at FROM \`tickets\` WHERE \`branch_id\` = ? ORDER BY \`created_at\` DESC`;
    const results = await sequelize.query(sql, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getTicketDataByTicketNumber: async (ticketNumber, branchId, callback) => {

    const sql = `SELECT id, title, created_at FROM \`tickets\` WHERE \`ticket_number\` = ? AND \`branch_id\` = ? LIMIT 1`;
    console.log(
      `Executing SQL: ${sql} with ticketNumber: ${ticketNumber} and branchId: ${branchId}`
    ); // Debug log
    const ticketResults = await sequelize.query(sql, {
      replacements: [ticketNumber, branchId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (ticketResults.length === 0) {
      return callback({ message: "Ticket not found" }, null);
    }
    const ticketData = ticketResults[0];
    const conversationsSql = `SELECT id, \`from\`, message, created_at FROM \`ticket_conversations\` WHERE ticket_id = ? AND branch_id = ?`;
    console.log(
      `Executing SQL: ${conversationsSql} with ticketId: ${ticketData.id} and branchId: ${branchId}`
    ); // Debug log
    const conversationResults = await sequelize.query(conversationsSql, {
      replacements: [ticketData.id, branchId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    // Return both ticket data and conversations
    callback(null, {
      ticket: ticketData,
      conversations: conversationResults,
    });


  },

  chat: async (ticketData, callback) => {
    try {
      if (!ticketData || !ticketData.ticket_number || !ticketData.branch_id) {
        return callback({ message: "Invalid ticket data" }, null);
      }

      console.log("Fetching ticket with:", ticketData.ticket_number, ticketData.branch_id);

      const sql = `SELECT id, title, description, created_at FROM \`tickets\` WHERE \`ticket_number\` = ? AND \`branch_id\` = ? LIMIT 1`;

      const ticketResults = await sequelize.query(sql, {
        replacements: [ticketData.ticket_number, ticketData.branch_id],
        type: QueryTypes.SELECT,
      });

      if (!ticketResults || ticketResults.length === 0) {
        return callback({ message: "Ticket not found" }, null);
      }

      const ticketQryData = ticketResults[0];

      if (!ticketData.message || !ticketData.customer_id) {
        return callback({ message: "Message or customer_id missing" }, null);
      }

      console.log("Inserting conversation with:", {
        branch_id: ticketData.branch_id,
        customer_id: ticketData.customer_id,
        ticket_id: ticketQryData.id,
        message: ticketData.message,
      });

      const sqlInsertTicketConversation = `
        INSERT INTO \`ticket_conversations\` (
          \`branch_id\`, \`customer_id\`, \`ticket_id\`, \`from\`, \`message\`
        ) VALUES (?, ?, ?, ?, ?)
      `;

      const conversationResults = await sequelize.query(sqlInsertTicketConversation, {
        replacements: [
          ticketData.branch_id,
          ticketData.customer_id,
          ticketQryData.id,
          "branch",
          ticketData.message,
        ],
        type: QueryTypes.INSERT,
      });

      const conversationId = conversationResults[0]; // Use [0] instead of .insertId

      console.log("Fetching created_at for conversation ID:", conversationId);

      const sqlGetCreatedAt = `
        SELECT \`created_at\`
        FROM \`ticket_conversations\`
        WHERE \`id\` = ?
      `;

      const result = await sequelize.query(sqlGetCreatedAt, {
        replacements: [conversationId],
        type: QueryTypes.SELECT,
      });

      if (!result || result.length === 0) {
        return callback({ message: "Failed to fetch created_at" }, null);
      }

      const createdAt = result[0].created_at;

      callback(null, {
        title: ticketQryData.title,
        description: ticketQryData.description,
        created_at: createdAt,
      });
    } catch (error) {
      console.error("Error in chat function:", error);
      callback({ message: "Internal Server Error", error }, null);
    }
  },


  delete: async (ticket_number, branch_id, callback) => {

    const sql = `SELECT id FROM \`tickets\` WHERE \`ticket_number\` = ? AND \`branch_id\` = ? LIMIT 1`;

    const ticketResults = await sequelize.query(sql, {
      replacements: [ticket_number, branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (ticketResults.length === 0) {
       // Release connection if no ticket found
      return callback({ message: "Ticket not found" }, null);
    }

    const ticketQryData = ticketResults[0];

    // Proceed with deletion of ticket conversations
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
