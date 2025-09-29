// AIDEV-NOTE: Centralized Canvas CSS selectors for easy maintenance when Canvas UI changes
// Selectors are grouped by page type and functionality, more specific selectors are in their
// respective scraper files `src/scrapers/*` (e.g., assignment, quiz, discussion)

export const SELECTORS = {
  // Login page selectors
  login: {
    // await page.getByRole('textbox', { name: 'IdentiKey Username' }).click();
    // await page.getByRole('textbox', { name: 'IdentiKey Password' }).click();
    username: 'input[id="username"]',
    password: 'input[id="password"]',
    submit: 'button[type="submit"]',
  },

  // Navigation and dashboard selectors
  navigation: {
    dashboardLink: 'a[id="global_nav_dashboard_link"]',
    plannerButton: 'button[id="planner-today-btn"]',
    userProfile: "[data-user-display-name], #global_nav_profile_link",
  },

  // Planner view selectors for discovering items
  planner: {
    // test in browser console: $$("div[class*='planner-item'] >> a[class*='view-link']")
    items: "div[class*='planner-item'] >> a[class*='view-link']",
    // Legacy selector patterns (kept for reference)
    itemsOld: "div[class*='planner-item'] >> div[class*='title'] >> a",
  },

  // Page content containers
  content: {
    main: '//*[@id="content"]',
    mainWithChildren: '//*[@id="content"]/*',
    spinner: '//*[@id="content"]//div[contains(@class, "spinner")]',
  },

  // Breadcrumb navigation selectors
  breadcrumbs: {
    links: "#breadcrumbs a",
    className:
      "#breadcrumbs > ul:nth-child(1) > li:nth-child(2) > a:nth-child(1) > span:nth-child(1)",
    firstLevel:
      "#breadcrumbs > ul:nth-child(1) > li:nth-child(1) > a:nth-child(1) > span:nth-child(1)",
  },

  // AIDEV-NOTE: Content verification selectors for identifying Canvas content types
  // These remain centralized since they're used for type detection across the scraper
  verification: {
    assignment: {
      container: "#assignment-student-header-content",
      containerOld: "div[id='assignment_show']", // Legacy selector kept for reference
    },
    quiz: {
      container: "div[id='quiz_show']",
    },
    discussion: {
      replyAction: "a[class='discussion-reply-action discussion-reply-box']",
    },
  },
};

// AIDEV-NOTE: Helper functions for common selector operations
// NOTE: Assignment, quiz, and discussion selectors moved to their respective scraper files
export const getSelectorContext = (pageType) => {
  switch (pageType) {
    case "login":
      return SELECTORS.login;
    case "navigation":
      return SELECTORS.navigation;
    case "planner":
      return SELECTORS.planner;
    case "content":
      return SELECTORS.content;
    case "breadcrumbs":
      return SELECTORS.breadcrumbs;
    default:
      throw new Error(`Unknown page type: ${pageType}`);
  }
};

// AIDEV-NOTE: Selector validation helper for debugging Canvas UI changes
export const validateSelector = async (
  page,
  selector,
  expectedCount = null,
) => {
  try {
    const elements = await page.$$(selector);
    const found = elements.length;

    if (expectedCount !== null && found !== expectedCount) {
      console.warn(
        `Selector "${selector}" found ${found} elements, expected ${expectedCount}`,
      );
      return false;
    }

    return found > 0;
  } catch (error) {
    console.error(
      `Selector validation failed for "${selector}":`,
      error.message,
    );
    return false;
  }
};
