import logger from "../logger.js";

// Assignment page selectors
// consider swtiching to more 'pywright style' selectors
const SELECTORS = {
  assignment: {
    // Verification selector
    container: "#assignment-student-header-content",
    // Legacy verification selector (kept for reference)
    containerOld: "div[id='assignment_show']",
    // Data extraction selectors
    // legacy title: 'h1[class="title"]',
    // await expect(page.getByTestId('title')).toContainText('Assignment Title');
    title: '#assignment-student-header-content >> data-testid="title"',
    status: 'data-testid="submission-workflow-tracker-title"', // e.g. "In Progress"
    subStatus: 'data-testid="submission-workflow-tracker-subtitle"', // e.g. "NEXT UP: Submit Assignment"
    // await expect(page.getByTestId('due-date')).toContainText('Due: Mon Sep 22, 2025 4:00pm');
    // dueDate: "span[class='date_text']",
    dueDate: (page) => page.getByTestId("due-date"),
    // getByTestId('assignments-2-assignment-toggle-details-text')
    // contains sub-elements, but innerText works well
    description:
      'div[data-testid="assignments-2-assignment-toggle-details-text"]',
  },
};

export const scrape_assignment_data = async (content) => {
  try {
    // Get title
    let title = "Untitled Assignment";
    try {
      // page.getByTestId('title')
      const titleElement = await content.getByTestId("title");
      if (titleElement) {
        title = await titleElement.innerText();
      } else {
        throw new Error("Assignment title element not found");
      }
    } catch (titleError) {
      // AIDEV-NOTE: Assignment title extraction error with fallback
      logger.warn("Failed to extract assignment title, using fallback", {
        context: "data_extraction",
        error: titleError.message,
        selector: SELECTORS.assignment.title,
        fallbackTitle: title,
        operation: "assignment_title_extraction",
      });
    }

    // Get due date
    let due_date = "No due date";
    try {
      const dueDateElement = await SELECTORS.assignment.dueDate(content);
      if (dueDateElement) {
        due_date = await dueDateElement.innerText();
        // Clean up due date text if needed
        due_date = due_date.replace("Due: ", "").trim();
      } else {
        throw new Error("Assignment due date element not found");
      }
    } catch (dueDateError) {
      // AIDEV-NOTE: Assignment due date extraction error with fallback
      logger.warn("Failed to extract assignment due date, using fallback", {
        context: "data_extraction",
        error: dueDateError.message,
        selector: SELECTORS.assignment.dueDate,
        fallbackDueDate: due_date,
        operation: "assignment_due_date_extraction",
      });
    }

    // Get description
    let description = "";
    try {
      const descElement = await content.$(SELECTORS.assignment.description);
      if (descElement) {
        description = await descElement.innerText();
      }
    } catch (descError) {
      // AIDEV-NOTE: Assignment description extraction error - non-critical
      logger.warn("Failed to extract assignment description", {
        context: "data_extraction",
        error: descError.message,
        selector: SELECTORS.assignment.description,
        operation: "assignment_description_extraction",
      });
    }

    // AIDEV-NOTE: Assignment data extracted

    return {
      title: title,
      due_date: { string: due_date.replace(" by ", " ") },
      description: description,
    };
  } catch (error) {
    // AIDEV-NOTE: Assignment data extraction error with comprehensive context
    logger.error("Assignment data extraction failed", {
      context: "data_extraction",
      error: error.message,
      errorType: error.constructor.name,
      selectors: {
        title: SELECTORS.assignment.title,
        dueDate: SELECTORS.assignment.dueDate,
        description: SELECTORS.assignment.description,
      },
      operation: "assignment_data_extraction",
    });
    throw error;
  }
};
