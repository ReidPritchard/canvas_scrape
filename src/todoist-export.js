// AIDEV-NOTE: Todoist export module handles all Todoist API integration and task management
import { TodoistApi } from "@doist/todoist-api-typescript";
import logger from "./logger.js";

/**
 * Export assignments to Todoist with duplicate detection and error handling
 * @param {Array} assignments - Array of assignment objects from Canvas scraper
 * @param {Object} config - Configuration object containing API keys and settings
 * @param {string} sessionId - Session ID for logging correlation
 * @param {Object} operationStats - Statistics object to track API operations
 * @returns {Promise<void>}
 */
export async function exportToTodoist(
  assignments,
  config,
  sessionId,
  operationStats,
) {
  // AIDEV-NOTE: Skip Todoist export if no API key configured
  if (!config.todoist_api_key && !process.env.TODOIST_API_KEY) {
    logger.info("Todoist export skipped - no API key configured", {
      context: "todoist_export",
      sessionId: sessionId,
      operation: "export_skipped",
    });
    return;
  }

  const todoistExportStart = Date.now();
  const todoistApi = new TodoistApi(
    process.env.TODOIST_API_KEY || config.todoist_api_key,
  );

  try {
    // AIDEV-NOTE: Todoist sync initiation logging with session tracking
    logger.info("Starting Todoist export with performance tracking", {
      context: "todoist_export",
      sessionId: sessionId,
      assignmentCount: assignments.length,
      operation: "export_start",
    });

    // AIDEV-NOTE: Updated to use REST API methods instead of deprecated Sync API
    let current_items, current_projects;
    try {
      // Get all tasks (both active and completed)
      const tasksResponse = await todoistApi.getTasks();
      current_items = tasksResponse.results || tasksResponse;

      // Get all projects
      const projectsResponse = await todoistApi.getProjects();
      current_projects = projectsResponse.results || projectsResponse;

      // AIDEV-NOTE: Todoist state management logging with item and project counts
      logger.info("Todoist state retrieved", {
        context: "todoist_export",
        sessionId: sessionId,
        totalItems: current_items.length,
        totalProjects: current_projects.length,
        operation: "state_management",
      });
    } catch (stateError) {
      // AIDEV-NOTE: Todoist state retrieval error
      logger.error("Failed to retrieve Todoist state", {
        context: "todoist_export",
        sessionId: sessionId,
        error: stateError.message,
        errorType: stateError.constructor.name,
        operation: "state_retrieval",
      });
      throw stateError;
    }

    for (const item of assignments) {
      try {
        // AIDEV-NOTE: Todoist item duplication check logging
        logger.debug("Checking for existing Todoist item", {
          context: "todoist_export",
          sessionId: sessionId,
          title: item.title,
          totalItems: current_items.length,
          operation: "duplication_check",
        });

        let previous_item;
        try {
          previous_item = await checkIfAlreadyAdded(current_items, item);

          logger.debug("Todoist item check completed", {
            context: "todoist_export",
            sessionId: sessionId,
            title: item.title,
            existingItem: !!previous_item,
            itemId: previous_item?.id,
            isCompleted: !!previous_item?.isCompleted,
            operation: "duplication_check_complete",
          });
        } catch (duplicateCheckError) {
          // AIDEV-NOTE: Todoist duplicate check error with recovery
          logger.warn(
            "Failed to check for existing Todoist item, assuming new",
            {
              context: "todoist_export",
              sessionId: sessionId,
              error: duplicateCheckError.message,
              title: item.title,
              operation: "duplication_check",
            },
          );
          previous_item = false; // Assume it's new if check fails
        }

        if (previous_item && previous_item.isCompleted) {
          // If previous item has already been completed don't update it
          // AIDEV-NOTE: Replaced console.log with structured logging for completed assignments
          logger.info("Skipping completed assignment", {
            context: "todoist_export",
            sessionId: sessionId,
            title: item.title,
            reason: "Already completed",
            isCompleted: previous_item.isCompleted,
          });
        } else {
          let project_id;
          try {
            project_id = await findRelatedProject(
              current_projects,
              item.class_name,
              sessionId,
            );
          } catch (projectError) {
            // AIDEV-NOTE: Project lookup error with fallback
            logger.warn("Failed to find related project, using default", {
              context: "todoist_export",
              sessionId: sessionId,
              error: projectError.message,
              title: item.title,
              className: item.class_name,
              operation: "project_lookup",
            });
            project_id = false; // Use default project
          }

          // AIDEV-NOTE: Clean date string by removing "Due: " prefix that Canvas adds to assignments
          const cleanedDueDate = item.due_date?.string?.replace(
            /^Due:\s*/i,
            "",
          );
          const cleaned_class_name = cleanName(class_name.toLowerCase());
          const data = {
            ...(item.title && { content: item.title }),
            ...(project_id && { projectId: project_id }),
            // Convert due date object to dueString for natural language processing
            ...(cleanedDueDate && { dueString: cleanedDueDate }),
            ...(item.description && {
              description: `${item.description}\n\n[Canvas Link](${item.url})`,
              labels: [cleaned_class_name, item.type],
            }),
            priority: 3,
          };

          if (previous_item === false) {
            // AIDEV-NOTE: Todoist add operation logging with item details
            logger.info("Adding new item to Todoist", {
              context: "todoist_export",
              sessionId: sessionId,
              title: item.title,
              dueDate: item.due_date?.string,
              projectId: project_id,
              priority: data.priority,
              action: "add",
            });

            try {
              const startTime = Date.now();
              const addResult = await todoistApi.addTask(data);
              const endTime = Date.now();

              operationStats.apiStats.todoist.creates++;

              // AIDEV-NOTE: Todoist add operation completion logging with timing and session tracking
              logger.info("Todoist item added successfully", {
                context: "todoist_export",
                sessionId: sessionId,
                title: item.title,
                itemId: addResult?.id,
                duration: endTime - startTime,
                action: "add_complete",
                apiStats: operationStats.apiStats.todoist,
              });
            } catch (e) {
              operationStats.apiStats.todoist.errors++;

              // AIDEV-NOTE: Todoist API error logging for add operations with session tracking
              logger.error("Todoist API error during item addition", {
                context: "todoist_export",
                sessionId: sessionId,
                error: e.message,
                errorType: e.constructor.name,
                assignmentTitle: item.title,
                projectId: project_id,
                dueDate: item.due_date?.string,
                stack: e.stack,
                action: "add_error",
                apiStats: operationStats.apiStats.todoist,
              });
            }
          } else {
            // AIDEV-NOTE: Build update data with Canvas link appended to description
            const updateData = {
              ...(item.description && {
                description: `${item.description}\n\n[Canvas Link](${item.url})`,
              }),
            };

            // AIDEV-NOTE: Skip update if there's nothing to update (e.g., quizzes without descriptions)
            if (Object.keys(updateData).length === 0) {
              logger.info("Skipping update - no changes needed", {
                context: "todoist_export",
                sessionId: sessionId,
                title: item.title,
                itemId: previous_item.id,
                reason: "No description to add",
                action: "update_skipped",
              });
            } else {
              // AIDEV-NOTE: Todoist update operation logging with item details
              logger.info("Updating existing Todoist item", {
                context: "todoist_export",
                sessionId: sessionId,
                title: item.title,
                dueDate: item.due_date?.string,
                itemId: previous_item.id,
                hasDescription: !!item.description,
                action: "update",
              });

              try {
                const startTime = Date.now();
                // AIDEV-NOTE: Updated to use updateTask() instead of deprecated items.update()
                const updateResult = await todoistApi.updateTask(
                  previous_item.id,
                  updateData,
                );
                const endTime = Date.now();

                operationStats.apiStats.todoist.updates++;

                // AIDEV-NOTE: Todoist update operation completion logging with timing and session tracking
                logger.info("Todoist item updated successfully", {
                  context: "todoist_export",
                  sessionId: sessionId,
                  title: item.title,
                  itemId: updateResult.id,
                  duration: endTime - startTime,
                  action: "update_complete",
                  apiStats: operationStats.apiStats.todoist,
                });
              } catch (e) {
                operationStats.apiStats.todoist.errors++;

                // AIDEV-NOTE: Todoist API error logging for update operations with session tracking
                logger.error("Todoist API error during item update", {
                  context: "todoist_export",
                  sessionId: sessionId,
                  error: e.message,
                  errorType: e.constructor.name,
                  assignmentTitle: item.title,
                  itemId: previous_item.id,
                  dueDate: item.due_date?.string,
                  stack: e.stack,
                  action: "update_error",
                  apiStats: operationStats.apiStats.todoist,
                });
              }
            }
          }
        }
      } catch (itemError) {
        // AIDEV-NOTE: Individual Todoist item processing error with recovery context
        logger.error("Failed to process assignment for Todoist export", {
          context: "todoist_export",
          sessionId: sessionId,
          error: itemError.message,
          errorType: itemError.constructor.name,
          assignmentTitle: item.title,
          className: item.class_name,
          operation: "item_processing",
        });
      }
    }

    // AIDEV-NOTE: Todoist export completion summary with comprehensive statistics
    const todoistExportDuration = Date.now() - todoistExportStart;
    logger.info("Todoist export completed", {
      context: "todoist_export",
      sessionId: sessionId,
      duration: todoistExportDuration,
      assignmentCount: assignments.length,
      apiStats: operationStats.apiStats.todoist,
      successRate: Math.round(
        ((operationStats.apiStats.todoist.creates +
          operationStats.apiStats.todoist.updates) /
          assignments.length) *
          100,
      ),
      operation: "export_complete",
    });
  } catch (error) {
    // AIDEV-NOTE: Global Todoist export error handler with session context
    logger.error("Todoist export failed completely", {
      context: "todoist_export",
      sessionId: sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentCount: assignments.length,
      duration: Date.now() - todoistExportStart,
      apiStats: operationStats.apiStats.todoist,
      operation: "export_failure",
    });
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Check if an assignment already exists in Todoist
 * @param {Array} items - Array of existing Todoist items
 * @param {Object} given_item - Assignment item to check
 * @returns {Promise<Object|boolean>} - Returns existing item or false if not found
 */
async function checkIfAlreadyAdded(items, given_item) {
  try {
    // AIDEV-NOTE: Duplicate detection by Canvas URL in task description or content
    const possible_item = items.find((item) => {
      // Check both content title match and Canvas URL in description
      const titleMatch = item.content === given_item.title;
      const urlMatch =
        given_item.url &&
        item.description &&
        item.description.includes(given_item.url);
      return titleMatch || urlMatch;
    });

    return possible_item ? possible_item : false;
  } catch (error) {
    // AIDEV-NOTE: Todoist item comparison error with array safety
    logger.error("Todoist item comparison failed", {
      context: "utility",
      error: error.message,
      errorType: error.constructor.name,
      itemsCount: items?.length || 0,
      givenItemTitle: given_item?.title || "Unknown",
      operation: "todoist_item_comparison",
    });
    return false; // Return false if comparison fails
  }
}

/**
 * Find a related Todoist project for a class name
 * @param {Array} projects - Array of Todoist projects
 * @param {string} class_name - Class name to find project for
 * @param {string} sessionId - Session ID for logging
 * @returns {Promise<string|boolean>} - Project ID or false if not found
 */
async function findRelatedProject(projects, class_name, sessionId) {
  try {
    const cleaned_class_name = cleanName(class_name.toLowerCase());

    // AIDEV-NOTE: Project lookup logging with class name matching
    logger.debug("Looking up related project", {
      context: "todoist_export",
      sessionId: sessionId,
      originalClassName: class_name,
      cleanedClassName: cleaned_class_name,
      availableProjects: projects.length,
      operation: "project_lookup",
    });

    const possible_project = projects.find((project) => {
      return project.name.toLowerCase().includes(cleaned_class_name);
    });

    // AIDEV-NOTE: Project lookup results logging with match details
    logger.debug("Project lookup completed", {
      context: "todoist_export",
      sessionId: sessionId,
      className: class_name,
      matchFound: !!possible_project,
      projectId: possible_project?.id,
      projectName: possible_project?.name,
      operation: "project_lookup_complete",
    });

    return possible_project ? possible_project.id : false;
  } catch (error) {
    // AIDEV-NOTE: Project lookup error with fallback behavior
    logger.error("Project lookup failed", {
      context: "todoist_export",
      sessionId: sessionId,
      error: error.message,
      errorType: error.constructor.name,
      className: class_name,
      projectsCount: projects?.length || 0,
      operation: "project_lookup",
    });
    return false; // Return false (default project) if lookup fails
  }
}

/**
 * Clean a string for project matching
 * @param {string} string - String to clean
 * @returns {string} - Cleaned string
 *
 * @example
 * "ATLS 5420-001" -> "atls 5420"
 */
function cleanName(string) {
  let cleaned = string
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Trim leading/trailing spaces
    .replace(/\s(-|section)\s.*$/, "") // Remove section identifiers like " - 001" or " section 001"
    .replace(/\s\d{3,}$/, ""); // Remove trailing numbers (e.g. " 5420")
  return cleaned;
}
