import { chromium } from "playwright";
import logger from "./logger.js";
import { SELECTORS } from "./selectors.js";
import { scrape_assignment_data } from "./scrapers/assignment.js";
import { scrape_quiz_data } from "./scrapers/quiz.js";
import { scrape_discussion_data } from "./scrapers/discussion.js";

// AIDEV-NOTE: Canvas scraper module - extracted from main.js for focused Canvas operations
// Handles all browser automation, login, navigation, and data extraction for Canvas LMS

const initializeBrowser = async (isDev, SESSION_ID) => {
  // AIDEV-NOTE: Browser initialization with mode detection
  if (isDev) {
    logger.info("Initializing browser in development mode", {
      context: "initialization",
      sessionId: SESSION_ID,
      headless: false,
      mode: "development",
    });
    return await chromium.launch({ headless: false });
  } else {
    return await chromium.launch({ headless: true });
  }
};

/**
 * Main Canvas scraping function that handles the complete workflow
 * @param {Object} config - Configuration object containing Canvas credentials and settings
 * @param {Object} config.account - Canvas login credentials
 * @param {string} config.account.username - Canvas username
 * @param {string} config.account.password - Canvas password
 * @param {string} config.url - Canvas base URL
 * @param {boolean} isDev - Whether to run in development mode (headless:false)
 * @param {string} sessionId - Session ID for operation tracking (passed from main.js)
 * @returns {Promise<Array>} Array of processed assignments, quizzes, and discussions
 */
export const scrapeCanvas = async (config, isDev = false, sessionId) => {
  // AIDEV-NOTE: Use session ID passed from main.js for consistent correlation
  const SESSION_ID = sessionId;

  // AIDEV-NOTE: Session-scoped logger ensures all entries include sessionId
  const sessionLogger = logger.child({ sessionId: SESSION_ID });

  // AIDEV-NOTE: Basic operational statistics
  const operationStats = {
    sessionId: SESSION_ID,
    startTime: Date.now(),
    scrapingStats: {
      totalItems: 0,
      processedItems: 0,
      assignments: 0,
      quizzes: 0,
      discussions: 0,
      errors: 0,
      skipped: 0,
    },
  };

  let browser, context, page;

  try {
    // AIDEV-NOTE: Session initialization with comprehensive session tracking
    sessionLogger.info("Starting Canvas scraping session", {
      context: "session_start",
      timestamp: operationStats.startTime,
      mode: isDev ? "development" : "production",
      nodeVersion: process.version,
      platform: process.platform,
    });

    browser = await initializeBrowser(isDev, SESSION_ID);

    // AIDEV-NOTE: Browser initialization completed
    logger.info("Browser initialized successfully", {
      context: "initialization",
      sessionId: SESSION_ID,
      browserType: "chromium",
    });

    // AIDEV-NOTE: Browser context and page creation with error handling
    context = await browser.newContext();
    page = await context.newPage();

    // Set timeouts for page operations
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);

    // AIDEV-NOTE: Canvas login and navigation workflow
    await performCanvasLogin(page, config, operationStats);
    await navigateToPlanner(page, config, operationStats);

    // AIDEV-NOTE: Item discovery and data extraction
    const assignments = await scrapeCanvasItems(
      page,
      context,
      config,
      operationStats,
    );

    // AIDEV-NOTE: Scraping completion with statistics summary
    logger.info("Scraping completed", {
      context: "scraping",
      sessionId: SESSION_ID,
      assignmentsFound: assignments.length,
      operationStats: {
        ...operationStats.scrapingStats,
        successRate: Math.round(
          (operationStats.scrapingStats.processedItems /
            operationStats.scrapingStats.totalItems) *
            100,
        ),
      },
      assignments: assignments.map((a) => ({
        title: a.title,
        class: a.class_name,
        due: a.due_date?.string,
      })),
    });

    return assignments;
  } catch (error) {
    // AIDEV-NOTE: Global error handler for unhandled promise rejections with session tracking
    operationStats.scrapingStats.errors++;

    logger.error("Unhandled error in Canvas scraping - session terminated", {
      context: "global_error",
      sessionId: SESSION_ID,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      operation: "canvas_scraping",
      sessionStats: {
        itemsProcessed: operationStats.scrapingStats.processedItems,
        totalItems: operationStats.scrapingStats.totalItems,
        errors: operationStats.scrapingStats.errors,
      },
    });
    throw error;
  } finally {
    // AIDEV-NOTE: Browser cleanup with error handling and final session statistics
    try {
      if (page) await page.close();
      if (browser) await browser.close();

      // AIDEV-NOTE: Final session summary
      logger.info("Canvas scraping session completed successfully", {
        context: "session_end",
        sessionId: SESSION_ID,
        operation: "browser_close",
        finalStats: {
          itemsProcessed: operationStats.scrapingStats.processedItems,
          totalItems: operationStats.scrapingStats.totalItems,
          assignments: operationStats.scrapingStats.assignments,
          quizzes: operationStats.scrapingStats.quizzes,
          discussions: operationStats.scrapingStats.discussions,
          errors: operationStats.scrapingStats.errors,
          skipped: operationStats.scrapingStats.skipped,
          successRate: Math.round(
            (operationStats.scrapingStats.processedItems /
              Math.max(operationStats.scrapingStats.totalItems, 1)) *
              100,
          ),
        },
      });
    } catch (cleanupError) {
      // AIDEV-NOTE: Browser cleanup error logging with session context
      logger.error("Browser cleanup failed", {
        context: "cleanup",
        sessionId: SESSION_ID,
        error: cleanupError.message,
        errorType: cleanupError.constructor.name,
        operation: "browser_close",
      });
    }
  }
};

/**
 * Handles Canvas login workflow
 * @private
 */
const performCanvasLogin = async (page, config, operationStats) => {
  const { account, url } = config;

  try {
    // AIDEV-NOTE: Canvas navigation with timeout and error handling
    await page.goto(url, { waitUntil: "load", timeout: 60000 });

    logger.info("Canvas navigation completed", {
      context: "navigation",
      sessionId: operationStats.sessionId,
      url: url,
      operation: "initial_page_load_complete",
    });
  } catch (error) {
    // AIDEV-NOTE: Canvas navigation error handling with network context and session tracking
    operationStats.scrapingStats.errors++;
    logger.error("Failed to navigate to Canvas", {
      context: "navigation",
      sessionId: operationStats.sessionId,
      error: error.message,
      errorType: error.constructor.name,
      url: url,
      stack: error.stack,
      operation: "initial_page_load",
    });
    throw error;
  }

  try {
    // AIDEV-NOTE: Canvas login attempt logging with authentication context
    logger.info("Attempting Canvas login", {
      context: "authentication",
      sessionId: operationStats.sessionId,
      url: url,
      username: account.username ? "[PROVIDED]" : "[MISSING]",
    });

    // Check if login form elements are present
    try {
      // await page.getByRole('textbox', { name: 'IdentiKey Username' }).click();
      // await page.getByRole('textbox', { name: 'IdentiKey Password' }).click();
      await page.waitForSelector(SELECTORS.login.username, { timeout: 15000 });
      await page.waitForSelector(SELECTORS.login.password, { timeout: 5000 });
      await page.waitForSelector(SELECTORS.login.submit, { timeout: 5000 });
    } catch (selectorError) {
      // AIDEV-NOTE: Login form selector error handling with page content debugging
      logger.error("Canvas login form elements not found", {
        context: "authentication",
        error: selectorError.message,
        url: page.url(),
        pageTitle: await page.title().catch(() => "Unknown"),
        selectors: {
          username: SELECTORS.login.username,
          password: SELECTORS.login.password,
          submit: SELECTORS.login.submit,
        },
        operation: "form_element_detection",
      });
      throw selectorError;
    }

    // Fill login form
    await page.fill(SELECTORS.login.username, account.username);
    await page.fill(SELECTORS.login.password, account.password);

    // Submit form
    await page.click(SELECTORS.login.submit);

    // Wait until page loads
    try {
      await page.waitForSelector(SELECTORS.navigation.dashboardLink, {
        state: "attached",
        timeout: 30000,
      });
    } catch (dashboardError) {
      // AIDEV-NOTE: Dashboard link detection error handling with authentication failure context
      operationStats.scrapingStats.errors++;
      logger.error("Dashboard link not found after login attempt", {
        context: "authentication",
        sessionId: operationStats.sessionId,
        error: dashboardError.message,
        currentUrl: page.url(),
        pageTitle: await page.title().catch(() => "Unknown"),
        selector: SELECTORS.navigation.dashboardLink,
        possibleCause: "Invalid credentials or Canvas UI change",
        operation: "post_login_verification",
      });
      throw dashboardError;
    }

    // AIDEV-NOTE: Canvas login success logging with navigation info
    logger.info("Canvas login successful", {
      context: "authentication",
      sessionId: operationStats.sessionId,
      nextStep: "dashboard_navigation",
    });
  } catch (error) {
    // AIDEV-NOTE: Canvas login error handling with session tracking
    operationStats.scrapingStats.errors++;
    logger.error("Canvas login failed", {
      context: "authentication",
      sessionId: operationStats.sessionId,
      error: error.message,
      errorType: error.constructor.name,
      currentUrl: page.url(),
      hasUsername: !!account.username,
      hasPassword: !!account.password,
      operation: "login_process",
    });
    throw error;
  }
};

/**
 * Navigates to Canvas planner view
 * @private
 */
const navigateToPlanner = async (page, config, operationStats) => {
  const { url } = config;

  try {
    // Navigate to dashboard if needed
    const href = await page.evaluate(() => document.location.href);

    if (href != url) {
      // AIDEV-NOTE: Dashboard navigation
      try {
        await page.click(SELECTORS.navigation.dashboardLink);
      } catch (clickError) {
        // AIDEV-NOTE: Dashboard navigation click error with selector debugging
        operationStats.scrapingStats.errors++;
        logger.error("Failed to click dashboard link", {
          context: "navigation",
          sessionId: operationStats.sessionId,
          error: clickError.message,
          selector: SELECTORS.navigation.dashboardLink,
          currentUrl: href,
          operation: "dashboard_navigation",
        });
        throw clickError;
      }
    }

    // Wait until page loads
    try {
      await page.waitForSelector(SELECTORS.navigation.plannerButton, {
        state: "attached",
        timeout: 30000,
      });
    } catch (plannerError) {
      // AIDEV-NOTE: Planner button detection error with fallback debugging
      operationStats.scrapingStats.errors++;
      logger.error("Planner button not found after dashboard navigation", {
        context: "navigation",
        sessionId: operationStats.sessionId,
        error: plannerError.message,
        selector: SELECTORS.navigation.plannerButton,
        currentUrl: page.url(),
        pageTitle: await page.title().catch(() => "Unknown"),
        possibleCause: "Canvas UI change or permission issue",
        operation: "planner_access",
      });
      throw plannerError;
    }

    // AIDEV-NOTE: Planner navigation and item discovery logging
    logger.info("Accessing Canvas planner view", {
      context: "navigation",
      sessionId: operationStats.sessionId,
      selector: SELECTORS.navigation.plannerButton,
      view: "planner",
    });
  } catch (error) {
    // AIDEV-NOTE: Dashboard navigation error handling with comprehensive context and session tracking
    operationStats.scrapingStats.errors++;
    logger.error("Dashboard navigation failed", {
      context: "navigation",
      sessionId: operationStats.sessionId,
      error: error.message,
      errorType: error.constructor.name,
      currentUrl: page.url(),
      stack: error.stack,
      operation: "dashboard_navigation",
    });
    throw error;
  }
};

/**
 * Discovers and scrapes all Canvas items (assignments, quizzes, discussions)
 * @private
 */
const scrapeCanvasItems = async (page, context, config, operationStats) => {
  const { url } = config;

  let item_links;
  try {
    // AIDEV-NOTE: Item discovery and Canvas state capture
    const preDiscoveryState = await page.evaluate(async () => {
      return {
        url: document.location.href,
        title: document.title,
        timestamp: Date.now(),
      };
    });

    // Next find every planner day that contains elements
    item_links = await page.$$(SELECTORS.planner.items);

    operationStats.scrapingStats.totalItems = item_links.length;

    // AIDEV-NOTE: Item discovery logging with count and selector info
    logger.info("Discovered planner items", {
      context: "scraping",
      sessionId: operationStats.sessionId,
      itemCount: item_links.length,
      selector: SELECTORS.planner.items,
      pageTitle: preDiscoveryState.title,
      operation: "item_discovery_complete",
    });

    if (item_links.length === 0) {
      // AIDEV-NOTE: No items found warning with troubleshooting context and session info
      logger.warn("No planner items found", {
        context: "scraping",
        sessionId: operationStats.sessionId,
        selector: SELECTORS.planner.items,
        currentUrl: page.url(),
        possibleCause: "No assignments or Canvas UI change",
        operation: "item_discovery",
        canvasState: preDiscoveryState,
      });
    }
  } catch (error) {
    // AIDEV-NOTE: Item discovery error handling with selector debugging and session tracking
    operationStats.scrapingStats.errors++;
    logger.error("Failed to discover planner items", {
      context: "scraping",
      sessionId: operationStats.sessionId,
      error: error.message,
      errorType: error.constructor.name,
      selector: SELECTORS.planner.items,
      currentUrl: page.url(),
      stack: error.stack,
      operation: "item_discovery",
    });
    throw error;
  }

  let assignments = [];

  // AIDEV-NOTE: Process each discovered item
  for (let i = 0; i < item_links.length; i++) {
    let assignment_page;
    let itemTitle = "Unknown";

    try {
      // Create new page
      assignment_page = await context.newPage();

      // Set timeouts for assignment pages
      assignment_page.setDefaultTimeout(20000);
      assignment_page.setDefaultNavigationTimeout(30000);

      // Get item title for logging
      try {
        itemTitle = (await item_links[i].innerText()).replace("\n", " ");
      } catch (titleError) {
        // AIDEV-NOTE: Item title extraction error with fallback logging and session tracking
        logger.warn("Failed to extract item title", {
          context: "scraping",
          sessionId: operationStats.sessionId,
          error: titleError.message,
          itemIndex: i + 1,
          operation: "title_extraction",
        });
        itemTitle = `Item ${i + 1}`;
      }

      logger.info("Starting planner item scrape", {
        context: "scraping",
        sessionId: operationStats.sessionId,
        title: itemTitle,
        itemIndex: i + 1,
        totalItems: item_links.length,
        progressPercent: Math.round(((i + 1) / item_links.length) * 100),
        operationStats: {
          processed: operationStats.scrapingStats.processedItems,
          errors: operationStats.scrapingStats.errors,
        },
      });

      // Open assignment/item page
      let itemUrl;
      try {
        const href = await item_links[i].getAttribute("href");
        itemUrl = url + href;
        await assignment_page.goto(itemUrl);
      } catch (navigationError) {
        // AIDEV-NOTE: Assignment page navigation error with recovery context
        logger.error("Failed to navigate to assignment page", {
          context: "navigation",
          error: navigationError.message,
          errorType: navigationError.constructor.name,
          itemIndex: i + 1,
          itemTitle: itemTitle,
          url: itemUrl,
          operation: "assignment_navigation",
        });
        await assignment_page.close();
        continue; // Skip this item and continue with next
      }

      // Wait for content to load
      await assignment_page.waitForSelector(SELECTORS.content.main, {
        state: "attached",
        timeout: 20000,
      });
      await assignment_page.waitForSelector(
        SELECTORS.content.mainWithChildren,
        {
          state: "attached",
          timeout: 20000,
        },
      );
      const spinner = await assignment_page.$(SELECTORS.content.spinner);
      if (spinner) {
        await spinner.waitForElementState("hidden", { timeout: 20000 });
      }

      // Find class_name
      let class_name = "Unknown Class";
      try {
        const classElement = await assignment_page.$(
          SELECTORS.breadcrumbs.className,
        );

        if (classElement) {
          class_name = await classElement.innerText();
        } else {
          throw new Error("Class name element not found");
        }
      } catch (classError) {
        // AIDEV-NOTE: Class name extraction error with fallback behavior
        logger.warn("Failed to extract class name, using fallback", {
          context: "scraping",
          error: classError.message,
          itemIndex: i + 1,
          itemTitle: itemTitle,
          fallbackClassName: class_name,
          selector: SELECTORS.breadcrumbs.className,
          operation: "class_name_extraction",
        });
      }

      // find content once page loads
      let content;
      try {
        // Content is dynamically loaded, we need to wait for children to appear
        // and/or the spinner to disappear

        // Wait for main content container to appear
        await assignment_page.waitForSelector(SELECTORS.content.main, {
          state: "visible",
        });

        // // Check for children inside content container
        // let children = await assignment_page.$$(SELECTORS.content.children);

        // // Wait until children are present
        // const maxRetries = 5;
        // let retries = 0;
        // while (children.length === 0 && retries < maxRetries) {
        //   await assignment_page.waitForTimeout(1000); // Wait 1 second
        //   children = await assignment_page.$$(SELECTORS.content.children);
        //   retries++;
        // }

        content = await assignment_page.$(SELECTORS.content.main);

        // Check for spinner presence
        let spinnerPresent =
          (await assignment_page.$(SELECTORS.content.spinner)) !== null;

        // Wait for spinner to disappear if present
        if (spinnerPresent) {
          logger.info("Waiting for content spinner to disappear", {
            context: "scraping",
            itemIndex: i + 1,
            itemTitle: itemTitle,
            url: assignment_page.url(),
            selector: SELECTORS.content.spinner,
            operation: "spinner_wait",
          });

          await assignment_page.waitForSelector(SELECTORS.content.spinner, {
            state: "hidden",
          });
        }

        if (!content) {
          throw new Error("Content container not found");
        }
      } catch (contentError) {
        // AIDEV-NOTE: Content container error with page debugging
        logger.error("Failed to find content container", {
          context: "scraping",
          error: contentError.message,
          itemIndex: i + 1,
          itemTitle: itemTitle,
          url: assignment_page.url(),
          selector: SELECTORS.content.main,
          operation: "content_container_detection",
        });
        await assignment_page.close();
        continue;
      }

      let data = { class_name: class_name };

      try {
        if (await verify_is_assignment(content, operationStats)) {
          // AIDEV-NOTE: Assignment verification with statistics tracking
          operationStats.scrapingStats.assignments++;
          data = {
            ...data,
            ...(await scrape_assignment_data(assignment_page)),
            url: assignment_page.url(),
            type: "assignment",
          };
        } else if (await verify_is_quiz(content, operationStats)) {
          // AIDEV-NOTE: Quiz verification with statistics tracking
          operationStats.scrapingStats.quizzes++;
          data = {
            ...data,
            ...(await scrape_quiz_data(assignment_page)),
            url: assignment_page.url(),
            type: "quiz",
          };
        } else if (await verify_is_discussion(content, operationStats)) {
          // AIDEV-NOTE: Discussion verification with statistics tracking
          operationStats.scrapingStats.discussions++;
          data = {
            ...data,
            ...(await scrape_discussion_data(assignment_page)),
            url: assignment_page.url(),
            type: "discussion",
          };
        } else {
          // AIDEV-NOTE: Unrecognized content type, skipping
          operationStats.scrapingStats.skipped++;
          await assignment_page.close();
          continue;
        }
      } catch (verificationError) {
        // AIDEV-NOTE: Content verification error with type detection debugging
        logger.error("Content verification failed", {
          context: "scraping",
          error: verificationError.message,
          errorType: verificationError.constructor.name,
          itemIndex: i + 1,
          itemTitle: itemTitle,
          className: class_name,
          url: assignment_page.url(),
          operation: "content_verification",
        });
        await assignment_page.close();
        continue;
      }

      // Add all info to object and push to array
      assignments.push(data);
      operationStats.scrapingStats.processedItems++;

      // AIDEV-NOTE: Page processing completed
    } catch (error) {
      // AIDEV-NOTE: Assignment processing error with comprehensive recovery context and session tracking
      operationStats.scrapingStats.errors++;
      logger.error("Assignment processing failed", {
        context: "scraping",
        sessionId: operationStats.sessionId,
        error: error.message,
        errorType: error.constructor.name,
        itemIndex: i + 1,
        itemTitle: itemTitle,
        totalItems: item_links.length,
        stack: error.stack,
        operation: "assignment_processing",
        operationStats: {
          processed: operationStats.scrapingStats.processedItems,
          errors: operationStats.scrapingStats.errors,
          successRate: Math.round(
            (operationStats.scrapingStats.processedItems / (i + 1)) * 100,
          ),
        },
      });
    } finally {
      // Ensure assignment page is always closed
      if (assignment_page) {
        try {
          await assignment_page.close();
        } catch (closeError) {
          // AIDEV-NOTE: Page cleanup error logging with session tracking
          logger.warn("Failed to close assignment page", {
            context: "scraping",
            sessionId: operationStats.sessionId,
            error: closeError.message,
            itemIndex: i + 1,
            operation: "page_cleanup",
          });
        }
      }

      logger.info("Completed planner item scrape", {
        context: "scraping",
        sessionId: operationStats.sessionId,
        title: itemTitle,
        itemIndex: i + 1,
        totalItems: item_links.length,
        progressPercent: Math.round(((i + 1) / item_links.length) * 100),
        operationStats: {
          processed: operationStats.scrapingStats.processedItems,
          errors: operationStats.scrapingStats.errors,
        },
        operation: "item_scrape_complete",
      });
    }
  }

  return assignments;
};

// AIDEV-NOTE: Content verification functions for different Canvas content types

const verify_is_assignment = async (content, operationStats) => {
  try {
    const result = !!(await content.$(
      SELECTORS.verification.assignment.container,
    ));
    return result;
  } catch (error) {
    // AIDEV-NOTE: Assignment verification error with selector debugging
    logger.error("Assignment verification failed", {
      context: "content_verification",
      error: error.message,
      errorType: error.constructor.name,
      selector: SELECTORS.verification.assignment.container,
      operation: "assignment_verification",
    });
    return false;
  }
};

const verify_is_quiz = async (content, operationStats) => {
  try {
    const result = !!(await content.$(SELECTORS.verification.quiz.container));
    return result;
  } catch (error) {
    // AIDEV-NOTE: Quiz verification error with selector debugging
    logger.error("Quiz verification failed", {
      context: "content_verification",
      error: error.message,
      errorType: error.constructor.name,
      selector: SELECTORS.verification.quiz.container,
      operation: "quiz_verification",
    });
    return false;
  }
};

const verify_is_discussion = async (content, operationStats) => {
  try {
    let temp_crumb = await content.$(SELECTORS.breadcrumbs.firstLevel);

    const discussionElement = await content.$(
      SELECTORS.verification.discussion.replyAction,
    );

    let breadcrumbText = "";
    if (temp_crumb) {
      try {
        breadcrumbText = await temp_crumb.innerText();
      } catch (textError) {
        // AIDEV-NOTE: Breadcrumb text extraction error
        logger.warn("Failed to extract breadcrumb text", {
          context: "content_verification",
          error: textError.message,
          operation: "breadcrumb_text_extraction",
        });
      }
    }

    const result = !!(
      discussionElement &&
      temp_crumb &&
      breadcrumbText === "Announcements"
    );

    return result;
  } catch (error) {
    // AIDEV-NOTE: Discussion verification error with comprehensive debugging
    logger.error("Discussion verification failed", {
      context: "content_verification",
      error: error.message,
      errorType: error.constructor.name,
      selectors: {
        discussion: SELECTORS.verification.discussion.replyAction,
        breadcrumb: SELECTORS.breadcrumbs.firstLevel,
      },
      operation: "discussion_verification",
    });
    return false;
  }
};

// AIDEV-NOTE: Data extraction functions moved to src/scrapers/ for modularity
