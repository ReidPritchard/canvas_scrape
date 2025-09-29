import logger from "../logger.js";

// AIDEV-NOTE: Quiz page selectors moved from centralized selectors.js
const SELECTORS = {
  quiz: {
    // Verification selector
    // await page.getByRole('link', { name: 'Quizzes' }).click();
    container: "div[id='quiz_show']",
    // Data extraction selectors
    // await expect(page.locator('#quiz_title')).toContainText('Quiz title');
    // await expect(page.locator('#quiz_student_details')).toContainText('Sep 23 at 11:59pm');
    // await expect(page.locator('#quiz_student_details')).toContainText('points');
    // await expect(page.locator('#quiz_student_details')).toContainText('Questions');
    // await expect(page.locator('#quiz_student_details')).toContainText('Time Limit');
    title: 'h1[id="quiz_title"]',
    dueDate:
      "#quiz_student_details > li:nth-child(1) > span:nth-child(2) > span:nth-child(1)",
    // hasStartButton: getByRole('button', { name: 'Take the Quiz' })
  },
};

export const scrape_quiz_data = async (content) => {
  try {
    // Get title
    let title = "Untitled Quiz";
    try {
      const titleElement = await content.$(SELECTORS.quiz.title);
      if (titleElement) {
        title = await titleElement.innerText();
      } else {
        throw new Error("Quiz title element not found");
      }
    } catch (titleError) {
      // AIDEV-NOTE: Quiz title extraction error with fallback
      logger.warn("Failed to extract quiz title, using fallback", {
        context: "data_extraction",
        error: titleError.message,
        selector: SELECTORS.quiz.title,
        fallbackTitle: title,
        operation: "quiz_title_extraction",
      });
    }

    // Get due date
    let due_date = "No due date";
    try {
      const dueDateElement = await content.$(SELECTORS.quiz.dueDate);
      if (dueDateElement) {
        due_date = await dueDateElement.innerText();
      } else {
        throw new Error("Quiz due date element not found");
      }
    } catch (dueDateError) {
      // AIDEV-NOTE: Quiz due date extraction error with fallback
      logger.warn("Failed to extract quiz due date, using fallback", {
        context: "data_extraction",
        error: dueDateError.message,
        selector: SELECTORS.quiz.dueDate,
        fallbackDueDate: due_date,
        operation: "quiz_due_date_extraction",
      });
    }

    // AIDEV-NOTE: Quiz data extracted

    return {
      title: title,
      due_date: { string: due_date.replace(" by ", " ") },
      description: null,
    };
  } catch (error) {
    // AIDEV-NOTE: Quiz data extraction error with comprehensive context
    logger.error("Quiz data extraction failed", {
      context: "data_extraction",
      error: error.message,
      errorType: error.constructor.name,
      selectors: {
        title: SELECTORS.quiz.title,
        dueDate: SELECTORS.quiz.dueDate,
      },
      operation: "quiz_data_extraction",
    });
    throw error;
  }
};
