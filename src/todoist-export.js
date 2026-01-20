// AIDEV-NOTE: Todoist export module handles all Todoist API integration and task management
import { TodoistApi } from "@doist/todoist-api-typescript";
import logger from "./logger.js";

// AIDEV-NOTE: Rate limit delay between Todoist API requests (ms)
const API_THROTTLE_DELAY_MS = 300;

/**
 * AIDEV-NOTE: Error Handling Policy
 * - State retrieval errors (fetchTodoistState) are FATAL - cannot proceed without current tasks/projects
 * - Individual assignment errors (processAssignment) are NON-FATAL - partial export is acceptable
 * - API call errors (createNewTask, updateExistingTask) are NON-FATAL - logged and counted in stats
 */

/**
 * @typedef {Object} CanvasAssignment
 * @property {string} title - Assignment title
 * @property {string} class_name - Course name (e.g., "ATLS 5420-001")
 * @property {Object} [due_date] - Due date information
 * @property {string} [due_date.string] - Due date string (may include "Due: " prefix)
 * @property {string} [description] - Assignment description (optional for quizzes)
 * @property {string} url - Canvas assignment URL
 * @property {string} type - Assignment type ("assignment", "quiz", "discussion")
 */

/**
 * @typedef {Object} TodoistConfig
 * @property {string} [todoist_api_key] - Todoist API key from config file
 */

/**
 * @typedef {Object} OperationStats
 * @property {Object} apiStats - API operation statistics
 * @property {Object} apiStats.todoist - Todoist-specific stats
 * @property {number} apiStats.todoist.creates - Count of created tasks
 * @property {number} apiStats.todoist.updates - Count of updated tasks
 * @property {number} apiStats.todoist.errors - Count of API errors
 */

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
      sessionId,
      operation: "export_skipped",
    });
    return;
  }

  const exportStartTime = Date.now();
  const todoistApi = new TodoistApi(
    process.env.TODOIST_API_KEY || config.todoist_api_key,
  );

  try {
    logger.info("Starting Todoist export with performance tracking", {
      context: "todoist_export",
      sessionId,
      assignmentCount: assignments.length,
      operation: "export_start",
    });

    // AIDEV-NOTE: Fetch current Todoist state for duplicate detection
    const { items: currentItems, projects: currentProjects } =
      await fetchTodoistState(todoistApi, sessionId);

    for (const item of assignments) {
      await processAssignment(
        item,
        todoistApi,
        currentItems,
        currentProjects,
        sessionId,
        operationStats,
      );

      // AIDEV-NOTE: Throttle requests to respect Todoist API rate limits
      await delay(API_THROTTLE_DELAY_MS);
    }

    logExportCompletion(
      exportStartTime,
      assignments.length,
      sessionId,
      operationStats,
    );
  } catch (error) {
    logger.error("Todoist export failed completely", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentCount: assignments.length,
      duration: Date.now() - exportStartTime,
      apiStats: operationStats.apiStats.todoist,
      operation: "export_failure",
    });
    throw error;
  }
}

/**
 * Fetch current Todoist tasks and projects for state management
 * @param {TodoistApi} api - Todoist API instance
 * @param {string} sessionId - Session ID for logging
 * @returns {Promise<{items: Array, projects: Array}>}
 */
async function fetchTodoistState(api, sessionId) {
  try {
    // AIDEV-NOTE: REST API methods handle pagination internally
    const tasksResponse = await api.getTasks();
    const items = tasksResponse.results || tasksResponse;

    const projectsResponse = await api.getProjects();
    const projects = projectsResponse.results || projectsResponse;

    logger.info("Todoist state retrieved", {
      context: "todoist_export",
      sessionId,
      totalItems: items.length,
      totalProjects: projects.length,
      operation: "state_management",
    });

    return { items, projects };
  } catch (error) {
    logger.error("Failed to retrieve Todoist state", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      operation: "state_retrieval",
    });
    throw error;
  }
}

/**
 * Process a single assignment for Todoist export
 * @param {Object} item - Assignment object from Canvas
 * @param {TodoistApi} api - Todoist API instance
 * @param {Array} currentItems - Existing Todoist tasks
 * @param {Array} currentProjects - Existing Todoist projects
 * @param {string} sessionId - Session ID for logging
 * @param {Object} operationStats - Statistics tracker
 */
async function processAssignment(
  item,
  api,
  currentItems,
  currentProjects,
  sessionId,
  operationStats,
) {
  try {
    const existingItem = findExistingItem(currentItems, item, sessionId);

    if (existingItem?.isCompleted) {
      logger.info("Skipping completed assignment", {
        context: "todoist_export",
        sessionId,
        title: item.title,
        reason: "Already completed",
        isCompleted: existingItem.isCompleted,
      });
      return;
    }

    // AIDEV-NOTE: Enhanced project/section matching logic
    const projectId = findProjectId(
      currentProjects,
      item.class_name,
      sessionId,
    );
    const sectionId = await findOrCreateSectionId(
      api,
      projectId,
      item.class_name,
      sessionId,
    );

    const taskData = buildTaskData(item, projectId, sectionId);

    if (existingItem) {
      await updateExistingTask(
        api,
        taskData,
        existingItem,
        item,
        sessionId,
        operationStats,
      );
    } else {
      await createNewTask(
        api,
        taskData,
        item,
        projectId,
        sessionId,
        operationStats,
      );
    }
  } catch (error) {
    logger.error("Failed to process assignment for Todoist export", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentTitle: item.title,
      className: item.class_name,
      operation: "item_processing",
    });
  }
}

/**
 * Check if an assignment already exists in Todoist
 * AIDEV-NOTE: Prioritizes URL matching (more reliable) over title matching (fallback)
 * @param {Array} items - Array of existing Todoist items
 * @param {CanvasAssignment} givenItem - Assignment item to check
 * @param {string} sessionId - Session ID for logging
 * @returns {Object|null} - Returns existing item or null if not found
 */
function findExistingItem(items, givenItem, sessionId) {
  logger.debug("Checking for existing Todoist item", {
    context: "todoist_export",
    sessionId,
    title: givenItem.title,
    hasUrl: !!givenItem.url,
    totalItems: items.length,
    operation: "duplication_check",
  });

  try {
    // AIDEV-NOTE: Prioritize URL match - Canvas URLs are stable even if titles change
    if (givenItem.url) {
      const urlMatch = items.find((item) =>
        item.description?.includes(givenItem.url),
      );

      if (urlMatch) {
        logger.debug("Todoist item found by URL match", {
          context: "todoist_export",
          sessionId,
          title: givenItem.title,
          itemId: urlMatch.id,
          matchType: "url",
          isCompleted: !!urlMatch.isCompleted,
          operation: "duplication_check_complete",
        });
        return urlMatch;
      }
    }

    // AIDEV-NOTE: Fallback to title match for legacy items without URL tracking
    const titleMatch = items.find((item) => item.content === givenItem.title);

    if (titleMatch) {
      logger.debug("Todoist item found by title match", {
        context: "todoist_export",
        sessionId,
        title: givenItem.title,
        itemId: titleMatch.id,
        matchType: "title",
        isCompleted: !!titleMatch.isCompleted,
        operation: "duplication_check_complete",
      });
      return titleMatch;
    }

    logger.debug("No existing Todoist item found", {
      context: "todoist_export",
      sessionId,
      title: givenItem.title,
      operation: "duplication_check_complete",
    });
    return null;
  } catch (error) {
    logger.warn("Failed to check for existing Todoist item, assuming new", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      title: givenItem.title,
      operation: "duplication_check",
    });
    return null;
  }
}

/**
 * Find a related Todoist project for a class name
 * AIDEV-NOTE: Implements fallback search for generic project names
 * @param {Array} projects - Array of Todoist projects
 * @param {string} className - Class name to find project for
 * @param {string} sessionId - Session ID for logging
 * @returns {string|null} - Project ID or null if not found
 */
function findProjectId(projects, className, sessionId) {
  try {
    const cleanedName = cleanClassName(className);
    const genericNames = [
      "school",
      "classes",
      "courses",
      "university",
      "college",
      "education",
      "studies",
      "academics",
      "learning",
      "students",
      "schoolwork",
      "assignments",
      "homework",
      "undergrad",
      "grad",
      "graduate",
      "postgrad",
      "postgraduate",
      "masters",
      "phd",
      "doctoral",
    ]; // Fallback project names

    logger.debug("Looking up related project", {
      context: "todoist_export",
      sessionId,
      originalClassName: className,
      cleanedClassName: cleanedName,
      availableProjects: projects.map((p) => p.name).join(", "),
      operation: "project_lookup",
    });

    // 1. Direct match (most specific)
    let matchedProject = projects.find((project) =>
      project.name.toLowerCase().includes(cleanedName),
    );

    // 2. Fallback to generic project names if no direct match found
    if (!matchedProject) {
      matchedProject = projects.find((project) =>
        // Match if any generic name is included in the project name
        genericNames.some((generic) =>
          project.name.toLowerCase().includes(generic),
        ),
      );
    }

    logger.debug("Project lookup completed", {
      context: "todoist_export",
      sessionId,
      className,
      matchFound: !!matchedProject,
      projectId: matchedProject?.id,
      projectName: matchedProject?.name,
      operation: "project_lookup_complete",
    });

    return matchedProject?.id || null;
  } catch (error) {
    logger.warn("Failed to find related project, using default", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      className,
      operation: "project_lookup",
    });
    return null;
  }
}

/**
 * Find or create a section within a project for the given class name.
 * @param {TodoistApi} api - The Todoist API instance.
 * @param {string} projectId - The ID of the project to search within.
 * @param {string} className - The name of the class to find or create a section for.
 * @param {string} sessionId - The session ID for logging.
 * @returns {Promise<string|null>} The section ID or null if not applicable.
 */
async function findOrCreateSectionId(api, projectId, className, sessionId) {
  if (!projectId) {
    return null; // Cannot create a section without a project
  }

  try {
    const sections = await api.getSections(projectId);
    const sectionName = cleanClassName(className);

    // Match any section that includes the cleaned class name
    let section = sections.results.find((sec) =>
      sec.name.toLowerCase().includes(sectionName),
    );

    if (!section) {
      logger.info(`No section found for "${sectionName}". Creating it.`, {
        context: "todoist_export",
        sessionId,
        projectId,
      });
      section = await api.addSection({
        name: sectionName,
        projectId: projectId,
      });
    }

    return section.id;
  } catch (error) {
    logger.error("Failed to find or create a Todoist section.", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      projectId,
      className,
    });
    return null;
  }
}

/**
 * Build task data object for Todoist API
 * @param {Object} item - Canvas assignment
 * @param {string|null} projectId - Todoist project ID
 * @param {string|null} sectionId - Todoist section ID
 * @returns {Object} - Task data for API
 */
function buildTaskData(item, projectId, sectionId) {
  // AIDEV-NOTE: Clean date string by removing "Due: " prefix that Canvas adds
  const cleanedDueDate = item.due_date?.string?.replace(/^Due:\s*/i, "");

  return {
    ...(item.title && { content: item.title }),
    ...(projectId && { projectId }),
    ...(sectionId && { sectionId }),
    ...(cleanedDueDate && { dueString: cleanedDueDate }),
    ...(item.description && {
      description: `${item.description}\n\n[Canvas Link](${item.url})`,
      labels: [item.class_name, item.type],
    }),
    priority: 3,
  };
}

/**
 * Create a new task in Todoist
 */
async function createNewTask(
  api,
  taskData,
  item,
  projectId,
  sessionId,
  operationStats,
) {
  logger.info("Adding new item to Todoist", {
    context: "todoist_export",
    sessionId,
    title: item.title,
    dueDate: item.due_date?.string,
    projectId,
    priority: taskData.priority,
    action: "add",
  });

  try {
    const startTime = Date.now();
    const result = await api.addTask(taskData);
    const duration = Date.now() - startTime;

    operationStats.apiStats.todoist.creates++;

    logger.info("Todoist item added successfully", {
      context: "todoist_export",
      sessionId,
      title: item.title,
      itemId: result?.id,
      duration,
      action: "add_complete",
      apiStats: operationStats.apiStats.todoist,
    });
  } catch (error) {
    operationStats.apiStats.todoist.errors++;

    logger.error("Todoist API error during item addition", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentTitle: item.title,
      projectId,
      dueDate: item.due_date?.string,
      stack: error.stack,
      action: "add_error",
      apiStats: operationStats.apiStats.todoist,
    });
  }
}

/**
 * Update an existing task in Todoist
 * @param {TodoistApi} api - Todoist API instance
 * @param {Object} taskData - New task data to update
 * @param {Object} existingItem - Existing Todoist item to update
 * @param {Object} item - Original Canvas assignment item
 * @param {string} sessionId - Session ID for logging
 * @param {Object} operationStats - Statistics tracker
 * @returns {Promise<void>}
 */
async function updateExistingTask(
  api,
  taskData,
  existingItem,
  item,
  sessionId,
  operationStats,
) {
  const updateData = {};

  // If description is missing in existing item but present in new item, add it
  if (item.description && !existingItem.description) {
    updateData.description = `${item.description}\n\n[Canvas Link](${item.url})`;
  }

  // If due date has changed, update it
  const cleanedDueDate = item.due_date?.string?.replace(/^Due:\s*/i, "");
  if (cleanedDueDate && existingItem.due?.string !== cleanedDueDate) {
    updateData.dueString = cleanedDueDate;
  }

  // Check if the task location needs to be updated (projectId or sectionId)
  const needsMove =
    (taskData.projectId && taskData.projectId !== existingItem.projectId) ||
    (taskData.sectionId && taskData.sectionId !== existingItem.sectionId);

  // If no updates are needed, skip the update
  if (Object.keys(updateData).length === 0 && !needsMove) {
    logger.info("Skipping update - no changes needed", {
      context: "todoist_export",
      sessionId,
      title: item.title,
      itemId: existingItem.id,
      reason: "No description to add",
      action: "update_skipped",
    });
    return;
  }

  logger.info("Updating existing Todoist item", {
    context: "todoist_export",
    sessionId,
    title: item.title,
    dueDate: item.due_date?.string,
    itemId: existingItem.id,
    hasDescription: !!item.description,
    action: "update",
  });

  // FIXME: refactor this so it's cleaner

  // Move the existing task if projectId or sectionId changed
  if (
    (taskData.projectId && taskData.projectId !== existingItem.projectId) ||
    (taskData.sectionId && taskData.sectionId !== existingItem.sectionId)
  ) {
    try {
      const startTime = Date.now();
      await api.moveTask(existingItem.id, {
        projectId: taskData.projectId,
        sectionId: taskData.sectionId,
      });
      const duration = Date.now() - startTime;

      logger.info("Todoist item moved successfully", {
        context: "todoist_export",
        sessionId,
        title: item.title,
        itemId: existingItem.id,
        duration,
        action: "move_complete",
      });
    } catch (error) {
      operationStats.apiStats.todoist.errors++;

      logger.error("Todoist API error during item move", {
        context: "todoist_export",
        sessionId,
        error: error.message,
        errorType: error.constructor.name,
        assignmentTitle: item.title,
        itemId: existingItem.id,
        dueDate: item.due_date?.string,
        stack: error.stack,
        action: "move_error",
        apiStats: operationStats.apiStats.todoist,
      });
    }
  }

  // Update any task fields as needed
  try {
    const startTime = Date.now();
    const result = await api.updateTask(existingItem.id, updateData);
    const duration = Date.now() - startTime;

    operationStats.apiStats.todoist.updates++;

    logger.info("Todoist item updated successfully", {
      context: "todoist_export",
      sessionId,
      title: item.title,
      itemId: result.id,
      duration,
      action: "update_complete",
      apiStats: operationStats.apiStats.todoist,
    });
  } catch (error) {
    operationStats.apiStats.todoist.errors++;

    logger.error("Todoist API error during item update", {
      context: "todoist_export",
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      assignmentTitle: item.title,
      itemId: existingItem.id,
      dueDate: item.due_date?.string,
      stack: error.stack,
      action: "update_error",
      apiStats: operationStats.apiStats.todoist,
    });
  }
}

/**
 * Log export completion with statistics
 */
function logExportCompletion(
  startTime,
  assignmentCount,
  sessionId,
  operationStats,
) {
  const duration = Date.now() - startTime;
  const { creates, updates } = operationStats.apiStats.todoist;
  const successRate =
    assignmentCount > 0
      ? Math.round(((creates + updates) / assignmentCount) * 100)
      : 0;

  logger.info("Todoist export completed", {
    context: "todoist_export",
    sessionId,
    duration,
    assignmentCount,
    apiStats: operationStats.apiStats.todoist,
    successRate,
    operation: "export_complete",
  });
}

/**
 * Clean a class name for project matching
 * @param {string} className - Class name to clean
 * @returns {string} - Cleaned string for matching
 * @example "ATLS 5420-001" -> "atls"
 */
function cleanClassName(className) {
  // AIDEV-NOTE: Remove special chars, section identifiers, and trailing numbers
  return className
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s(-|section)\s.*$/, "")
    .replace(/\s\d{3,}$/, "");
}

/**
 * Promise-based delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
