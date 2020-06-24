const { firefox } = require("playwright");
const Todoist = require("todoist");
const { account, url, todoist_api_key } = require("./config");

const todoist = Todoist(process.env.TODOIST_API_KEY || todoist_api_key);

(async () => {
	const browser = await firefox.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto(url);

	// Fill login form
	await page.fill('input[id="username"]', account.username);
	await page.fill('input[id="password"]', account.password);

	// Submit form
	await page.click('button[type="submit"]');

	// Wait until page loads
	await page.waitForSelector('a[id="global_nav_dashboard_link"]', {
		state: "attached",
	});

	// Navigate to dashboard if needed
	const href = await page.evaluate(() => document.location.href);
	if (href != url) {
		await page.click('a[id="global_nav_dashboard_link"]');
	}

	// Wait until page loads
	await page.waitForSelector('button[id="planner-today-btn"]', {
		state: "attached",
	});

	// save login cookies
	const cookies = await context.cookies();

	// Next find every planner day that contains elements
	// div[class*='planner-day']
	const item_links = await page.$$(
		"div[class*='planner-item'] >> div[class*='title'] >> a"
	);

	let assignments = [];

	for (let i = 0; i < item_links.length; i++) {
		// Create new page
		const assignment_page = await context.newPage();

		console.log(
			"Scraping: ",
			(await item_links[i].innerText()).replace("\n", " ")
		);

		// Open assignment/item page
		await assignment_page.goto(
			url + (await item_links[i].getAttribute("href"))
		);

		// Find class_name
		const class_name = await (
			await assignment_page.$(
				"#breadcrumbs > ul:nth-child(1) > li:nth-child(2) > a:nth-child(1) > span:nth-child(1)"
			)
		).innerText();

		// find content once page loads
		const content = await assignment_page.$('//*[@id="content"]');

		let data = { class_name: class_name };
		if (await verify_is_assignment(content)) {
			data = { ...data, ...(await scrape_assignment_data(content)) };
		} else if (await verify_is_quiz(content)) {
			data = { ...data, ...(await scrape_quiz_data(content)) };
		} else {
			continue;
		}

		// Add all info to object and push to array
		assignments.push(data);

		// close assignment page
		await assignment_page.close();
	}

	// console.log(assignments);

	todoist_export(assignments);

	await page.close();
	await browser.close();
})();

const verify_is_assignment = async (content) => {
	return !!(await content.$("div[id='assignment_show']"));
};

const verify_is_quiz = async (content) => {
	return !!(await content.$("div[id='quiz_show']"));
};

const scrape_quiz_data = async (content) => {
	// Get title
	const title = await (await content.$('h1[id="quiz_title"]')).innerText();

	// Get due date
	// #quiz_student_details > li:nth-child(1) > span:nth-child(2) > span:nth-child(1)
	const due_date = await (
		await content.$(
			"#quiz_student_details > li:nth-child(1) > span:nth-child(2) > span:nth-child(1)"
		)
	).innerText();

	return {
		title: title,
		due_date: { string: due_date.replace(" by ", " ") },
		description: null,
	};
};

const scrape_assignment_data = async (content) => {
	// Get title
	const title = await (await content.$('h1[class="title"]')).innerText();

	// Get due date
	const due_date = await (
		await content.$("span[class='date_text']")
	).innerText();

	// Get description
	const description = await (
		await content.$("div[class*='description']")
	).innerText();

	return {
		title: title,
		due_date: { string: due_date.replace(" by ", " ") },
		description: description,
	};
};

const todoist_export = async (assignments) => {
	await todoist.sync();

	const non_completed_items = todoist.items.get();

	// const current_projects = todoist.state["projects"];
	const all_things = await todoist.items.getAll();
	const current_projects = Object.values(all_things["projects"]);
	const current_items = non_completed_items.concat(
		Object.values(all_things["items"])
	);

	assignments.forEach(async (item) => {
		const previous_item = await check_if_already_added(current_items, item);

		if (previous_item && previous_item.completed_date) {
			// If previous item has already been completed don't update it
			console.log(
				"Skipping!",
				item.title,
				"has already been completed!!! Congrats!"
			);
		} else {
			const project_id = await find_related_project(
				current_projects,
				item.class_name
			);
			const data = {
				...(item.title && { content: item.title }),
				...(project_id && { project_id: project_id }),
				...(item.due_date && { due: item.due_date }),
				...{ priority: 3 },
			};

			if (previous_item === false) {
				console.log(
					"Adding",
					item.title,
					"to todoist. Due at",
					item.due_date.string
				);
				await todoist.items.add(data);
			} else {
				console.log(
					"Updating",
					item.title,
					"on todoist. Due at",
					item.due_date.string
				);
				await todoist.items.update({ ...data, id: previous_item.id });
			}
		}
	});
};

const check_if_already_added = async (items, given_item) => {
	const possible_item = items.find((item) => item.content === given_item.title);

	return possible_item ? possible_item : false;
};

const find_related_project = async (projects, class_name) => {
	const cleaned_class_name = await clean_name(class_name.toLowerCase());
	const possible_project = projects.find((project) =>
		project.name.toLowerCase().includes(cleaned_class_name)
	);
	return possible_project ? possible_project.id : false;
};

const clean_name = async (string) => {
	return string.replace(/[^a-zA-Z]/g, "");
};
