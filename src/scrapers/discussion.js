import logger from "../logger.js";

// AIDEV-NOTE: Discussion/announcement page selectors moved from centralized selectors.js
const SELECTORS = {
  discussion: {
    // Verification selectors
    replyAction: "a[class='discussion-reply-action discussion-reply-box']",
    // Data extraction selectors
    title: "h1[class='discussion-title']",
    publishDate: "div[class='discussion-pubdate']",
    description: "div[class='discussion-section message_wrapper']",
  },
};

export const scrape_discussion_data = async (content) => {
  try {
    // Get title
    let title = "Untitled Discussion";
    try {
      const titleElement = await content.$(SELECTORS.discussion.title);
      if (titleElement) {
        title = await titleElement.innerText();
      } else {
        throw new Error("Discussion title element not found");
      }
    } catch (titleError) {
      // AIDEV-NOTE: Discussion title extraction error with fallback
      logger.warn("Failed to extract discussion title, using fallback", {
        context: "data_extraction",
        error: titleError.message,
        selector: SELECTORS.discussion.title,
        fallbackTitle: title,
        operation: "discussion_title_extraction",
      });
    }

    // Get publish date (used as due date for discussions)
    let due_date = "No publish date";
    try {
      const pubDateElement = await content.$(SELECTORS.discussion.publishDate);
      if (pubDateElement) {
        due_date = await pubDateElement.innerText();
      } else {
        throw new Error("Discussion publish date element not found");
      }
    } catch (pubDateError) {
      // AIDEV-NOTE: Discussion publish date extraction error with fallback
      logger.warn("Failed to extract discussion publish date, using fallback", {
        context: "data_extraction",
        error: pubDateError.message,
        selector: SELECTORS.discussion.publishDate,
        fallbackPublishDate: due_date,
        operation: "discussion_publish_date_extraction",
      });
    }

    // Get description
    let description = "";
    try {
      const descElement = await content.$(SELECTORS.discussion.description);
      if (descElement) {
        description = await descElement.innerText();
      }
    } catch (descError) {
      // AIDEV-NOTE: Discussion description extraction error - non-critical
      logger.warn("Failed to extract discussion description", {
        context: "data_extraction",
        error: descError.message,
        selector: SELECTORS.discussion.description,
        operation: "discussion_description_extraction",
      });
    }

    // AIDEV-NOTE: Discussion data extracted

    return {
      title: title,
      due_date: { string: due_date.replace(" by ", " ") },
      description: description,
    };
  } catch (error) {
    // AIDEV-NOTE: Discussion data extraction error with comprehensive context
    logger.error("Discussion data extraction failed", {
      context: "data_extraction",
      error: error.message,
      errorType: error.constructor.name,
      selectors: {
        title: SELECTORS.discussion.title,
        publishDate: SELECTORS.discussion.publishDate,
        description: SELECTORS.discussion.description,
      },
      operation: "discussion_data_extraction",
    });
    throw error;
  }
};
