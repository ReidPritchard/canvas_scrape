// AIDEV-NOTE: Notion export module handles all Notion API integration and page management
import { Client } from "@notionhq/client";
import { parseDate } from "chrono-node";
import logger from "./logger.js";

/**
 * Export assignments to Notion with duplicate detection and error handling
 * @param {Array} assignments - Array of assignment objects from Canvas scraper
 * @param {Object} config - Configuration object containing API keys and settings
 * @param {string} sessionId - Session ID for logging correlation
 * @param {Object} operationStats - Statistics object to track API operations
 * @returns {Promise<void>}
 */
export async function exportToNotion(assignments, config, sessionId, operationStats) {
  // AIDEV-NOTE: Skip Notion export if no API key configured
  if (!config.notion_api_key && !process.env.NOTION_TOKEN) {
    logger.info("Notion export skipped - no API key configured", {
      context: "notion_export",
      sessionId: sessionId,
      operation: "export_skipped",
    });
    return;
  }

  // AIDEV-NOTE: Skip Notion export if no database ID configured
  if (!config.notion_db_id) {
    logger.warn("Notion export skipped - no database ID configured", {
      context: "notion_export",
      sessionId: sessionId,
      operation: "export_skipped",
    });
    return;
  }

  const notionExportStart = Date.now();
  const notion = new Client({
    auth: process.env.NOTION_TOKEN || config.notion_api_key,
  });

  try {
    // AIDEV-NOTE: Notion database query logging with database ID, filter info, and session tracking
    logger.info("Starting Notion export with performance tracking", {
      context: "notion_export",
      sessionId: sessionId,
      databaseId: config.notion_db_id,
      assignmentCount: assignments.length,
      filter: "Due Date next_year",
      operation: "export_start",
    });

    let future_tasks_res;
    try {
      future_tasks_res = await notion.databases.query({
        database_id: config.notion_db_id,
        filter: {
          or: [
            {
              property: "Due Date",
              date: {
                next_year: {},
              },
            },
          ],
        },
      });
    } catch (queryError) {
      // AIDEV-NOTE: Notion database query error with API details
      logger.error("Notion database query failed", {
        context: "notion_export",
        sessionId: sessionId,
        error: queryError.message,
        errorType: queryError.constructor.name,
        code: queryError.code,
        status: queryError.status,
        databaseId: config.notion_db_id,
        operation: "database_query",
      });
      throw queryError;
    }

    const future_tasks = future_tasks_res["results"];

    // AIDEV-NOTE: Database query results logging with task count
    logger.info("Notion database query completed", {
      context: "notion_export",
      sessionId: sessionId,
      tasksFound: future_tasks.length,
      operation: "database_query_complete",
    });

    const ref_date = Date();

    // AIDEV-NOTE: Process assignments sequentially to avoid rate limiting
    for (const item of assignments) {
      try {
        // AIDEV-NOTE: Date processing debug logging for timezone handling
        logger.debug("Processing assignment date", {
          context: "notion_export",
          sessionId: sessionId,
          title: item.title,
          originalDate: item["due_date"]["string"],
          timezone: "MDT",
        });

        let temp_date;
        try {
          temp_date = parseDate(item["due_date"]["string"], ref_date, {
            timezone: "MDT",
            forwardDate: true,
          });

          if (!temp_date) {
            throw new Error("Date parsing returned null");
          }

          // AIDEV-NOTE: Date parsing debug logging with parsed result
          logger.debug("Date parsed by chrono-node", {
            context: "notion_export",
            sessionId: sessionId,
            title: item.title,
            parsedDate: temp_date,
          });
        } catch (dateParseError) {
          // AIDEV-NOTE: Date parsing error with fallback behavior
          logger.warn("Failed to parse assignment date, using current date", {
            context: "notion_export",
            sessionId: sessionId,
            error: dateParseError.message,
            title: item.title,
            originalDate: item["due_date"]["string"],
            fallbackDate: new Date().toISOString(),
            operation: "date_parsing",
          });
          temp_date = new Date(); // Fallback to current date
        }

        try {
          temp_date = new Date(temp_date);

          // AIDEV-NOTE: Timezone offset adjustment for Notion API compatibility
          // FIXME: I'm not sure why I have to do this with notion to offset the timezone
          // I wish notion had a way to change it, but it doesn't seem to work
          temp_date.setHours(temp_date.getHours() - 7);

          // AIDEV-NOTE: Final date debug logging after timezone offset
          logger.debug("Final date after timezone adjustment", {
            context: "notion_export",
            sessionId: sessionId,
            title: item.title,
            finalDate: temp_date,
            isoString: temp_date.toISOString(),
          });

          item["due_date"]["string"] = temp_date.toISOString();
        } catch (dateProcessError) {
          // AIDEV-NOTE: Date processing error with recovery
          logger.error("Date processing failed, using original date", {
            context: "notion_export",
            sessionId: sessionId,
            error: dateProcessError.message,
            title: item.title,
            originalDate: item["due_date"]["string"],
            operation: "date_processing",
          });
          // Keep original date if processing fails
        }

        let previous_item;
        try {
          previous_item = await checkIfAlreadyAddedNotion(
            future_tasks,
            item,
            sessionId,
          );

          // AIDEV-NOTE: Item comparison debug logging for duplicate detection
          logger.debug("Checking for existing Notion item", {
            context: "notion_export",
            sessionId: sessionId,
            title: item.title,
            existingItem: !!previous_item,
            itemId: previous_item?.id,
          });
        } catch (duplicateCheckError) {
          // AIDEV-NOTE: Duplicate check error with recovery
          logger.warn(
            "Failed to check for existing Notion item, assuming new",
            {
              context: "notion_export",
              sessionId: sessionId,
              error: duplicateCheckError.message,
              title: item.title,
              operation: "duplicate_check",
            },
          );
          previous_item = false; // Assume it's new if check fails
        }

        if (previous_item) {
          // AIDEV-NOTE: Previous item match notification with update context
          logger.info("Existing Notion item found, updating", {
            context: "notion_export",
            sessionId: sessionId,
            title: item.title,
            pageId: previous_item.id,
            action: "update",
          });

          try {
            const startTime = Date.now();
            const update_response = await notion.pages.update({
              page_id: previous_item["id"],
              properties: {
                Title: {
                  title: [
                    {
                      type: "text",
                      text: {
                        content: item["title"],
                      },
                    },
                  ],
                },
                "Due Date": {
                  date: {
                    start: item["due_date"]["string"],
                  },
                },
                Tags: {
                  multi_select: [
                    {
                      name: "School",
                    },
                    {
                      name: item["class_name"],
                    },
                  ],
                },
                Description: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: item["description"] || "",
                      },
                    },
                  ],
                },
              },
            });
            const endTime = Date.now();

            operationStats.apiStats.notion.updates++;

            // AIDEV-NOTE: Notion page update completion logging with response details, timing, and session tracking
            logger.info("Notion page updated successfully", {
              context: "notion_export",
              sessionId: sessionId,
              assignmentTitle: item.title,
              pageId: update_response.id,
              className: item.class_name,
              dueDate: item.due_date.string,
              duration: endTime - startTime,
              action: "update_complete",
              apiStats: operationStats.apiStats.notion,
            });
          } catch (updateError) {
            operationStats.apiStats.notion.errors++;

            // AIDEV-NOTE: Notion page update error with comprehensive context and session tracking
            logger.error("Notion page update failed", {
              context: "notion_export",
              sessionId: sessionId,
              error: updateError.message,
              errorType: updateError.constructor.name,
              code: updateError.code,
              status: updateError.status,
              requestId: updateError.request_id,
              assignmentTitle: item.title,
              pageId: previous_item.id,
              className: item.class_name,
              dueDate: item.due_date.string,
              operation: "page_update",
              apiStats: operationStats.apiStats.notion,
            });
          }
        } else {
          try {
            // AIDEV-NOTE: Notion page creation attempt logging
            logger.info("Creating new Notion page", {
              context: "notion_export",
              sessionId: sessionId,
              title: item.title,
              className: item.class_name,
              dueDate: item.due_date.string,
              action: "create",
            });

            const startTime = Date.now();
            const response = await notion.pages.create({
              parent: { database_id: config.notion_db_id },
              properties: {
                Title: {
                  title: [
                    {
                      type: "text",
                      text: {
                        content: item["title"],
                      },
                    },
                  ],
                },
                "Due Date": {
                  date: {
                    start: item["due_date"]["string"],
                  },
                },
                PRIORITY: {
                  number: 3,
                },
                Status: {
                  select: {
                    name: "Not Started",
                  },
                },
                Tags: {
                  multi_select: [
                    {
                      name: "School",
                    },
                    {
                      name: item["class_name"],
                    },
                  ],
                },
                Description: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: item["description"] || "",
                      },
                    },
                  ],
                },
              },
            });
            const endTime = Date.now();

            operationStats.apiStats.notion.creates++;

            // AIDEV-NOTE: Notion page creation completion logging with response details, timing, and session tracking
            logger.info("Notion page created successfully", {
              context: "notion_export",
              sessionId: sessionId,
              assignmentTitle: item.title,
              pageId: response.id,
              className: item.class_name,
              dueDate: item.due_date.string,
              priority: 3,
              status: "Not Started",
              duration: endTime - startTime,
              action: "create_complete",
              apiStats: operationStats.apiStats.notion,
            });
          } catch (e) {
            operationStats.apiStats.notion.errors++;

            // AIDEV-NOTE: Enhanced Notion API error logging with comprehensive context and session tracking
            logger.error("Notion API error during page creation", {
              context: "notion_export",
              sessionId: sessionId,
              error: e.message,
              errorType: e.constructor.name,
              code: e.code,
              status: e.status,
              requestId: e.request_id,
              assignmentTitle: item.title,
              className: item.class_name,
              dueDate: item.due_date.string,
              stack: e.stack,
              action: "create_error",
              apiStats: operationStats.apiStats.notion,
            });
          }
        }
      } catch (itemError) {
        // AIDEV-NOTE: Individual item processing error with recovery context
        logger.error("Failed to process assignment for Notion export", {
          context: "notion_export",
          sessionId: sessionId,
          error: itemError.message,
          errorType: itemError.constructor.name,
          assignmentTitle: item.title,
          className: item.class_name,
          operation: "item_processing",
        });
      }
    }

    // AIDEV-NOTE: Notion export completion summary with comprehensive statistics
    const notionExportDuration = Date.now() - notionExportStart;
    logger.info("Notion export completed", {
      context: "notion_export",
      sessionId: sessionId,
      duration: notionExportDuration,
      assignmentCount: assignments.length,
      apiStats: operationStats.apiStats.notion,
      successRate: Math.round(
        ((operationStats.apiStats.notion.creates +
          operationStats.apiStats.notion.updates) /
          assignments.length) *
          100,
      ),
      operation: "export_complete",
    });
  } catch (error) {
    // AIDEV-NOTE: Global Notion export error handler with session context
    logger.error("Notion export failed completely", {
      context: "notion_export",
      sessionId: sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentCount: assignments.length,
      duration: Date.now() - notionExportStart,
      apiStats: operationStats.apiStats.notion,
      operation: "export_failure",
    });
  }
}

/**
 * Check if an assignment already exists in Notion database
 * @param {Array} items - Array of existing Notion items from database query
 * @param {Object} given_item - Assignment item to check for duplicates
 * @param {string} sessionId - Session ID for logging correlation
 * @returns {Object|false} - Existing item if found, false otherwise
 */
async function checkIfAlreadyAddedNotion(items, given_item, sessionId) {
  try {
    const possible_item = items.find(
      (item) =>
        item["properties"]["Title"]["title"][0]["plain_text"] ===
        given_item.title,
    );

    return possible_item ? possible_item : false;
  } catch (error) {
    // AIDEV-NOTE: Notion item comparison error with array safety
    logger.error("Notion item comparison failed", {
      context: "utility",
      sessionId: sessionId,
      error: error.message,
      errorType: error.constructor.name,
      itemsCount: items?.length || 0,
      givenItemTitle: given_item?.title || "Unknown",
      operation: "notion_item_comparison",
    });
    return false; // Return false if comparison fails
  }
}