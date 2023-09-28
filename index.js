const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
var cors = require("cors");
const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "junaid0000",
  database: "pooldb",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL");
});

// Create a new poll
app.post("/create-poll", (req, res) => {
  const { title, category, start_date, end_date, min_reward, max_reward } =
    req.body;

  console.log(title, category, start_date, end_date, min_reward, max_reward);
  console.log(req.body);
  const pollData = {
    title,
    category,
    start_date,
    end_date,
    min_reward,
    max_reward,
  };

  db.query("INSERT INTO polls SET ?", pollData, (err, result) => {
    if (err) {
      console.error("Error creating poll:", err);
      res
        .status(500)
        .json({ error: "An error occurred while creating the poll" });
      return;
    }

    res
      .status(201)
      .json({ message: "Poll created successfully", pollId: result.insertId });
  });
});

// ...

// Add question set to a poll
app.post("/add-question-set/:pollId", (req, res) => {
  const pollId = req.params.pollId; // Get pollId from URL parameter
  const { question_type, question_text, options } = req.body;

  // Validation: Check if question_type is 'single' or 'multiple'
  if (question_type !== "single" && question_type !== "multiple") {
    return res.status(400).json({ error: "Invalid question type" });
  }

  // Validation: Ensure question_text is provided
  if (!question_text) {
    return res.status(400).json({ error: "Question text is required" });
  }

  // Validation: Ensure options is an array and contains at least two options
  if (!Array.isArray(options) || options.length < 2) {
    return res
      .status(400)
      .json({ error: "Options must be an array with at least two items" });
  }

  // Check if the provided pollId exists in the database
  db.query(
    "SELECT id FROM polls WHERE id = ?",
    [pollId],
    (pollErr, pollResults) => {
      if (pollErr) {
        console.error("Error checking poll existence:", pollErr);
        return res
          .status(500)
          .json({ error: "An error occurred while checking poll existence" });
      }

      if (pollResults.length === 0) {
        return res.status(404).json({ error: "Poll not found" });
      }

      // Insert the question set into the database and associate it with the poll
      const questionSetData = {
        poll_id: pollId,
        question_type,
        question_text,
      };

      db.query(
        "INSERT INTO questions SET ?",
        questionSetData,
        (questionErr, questionResult) => {
          if (questionErr) {
            console.error("Error adding question set:", questionErr);
            return res.status(500).json({
              error: "An error occurred while adding the question set",
            });
          }

          const questionId = questionResult.insertId;

          // Insert options into the database
          const optionData = options.map((optionText) => ({
            question_id: questionId,
            option_text: optionText,
          }));

          db.query(
            "INSERT INTO options (question_id, option_text) VALUES ?",
            [optionData.map((opt) => [opt.question_id, opt.option_text])],
            (optionErr) => {
              if (optionErr) {
                console.error("Error adding options:", optionErr);
                return res
                  .status(500)
                  .json({ error: "An error occurred while adding options" });
              }

              res.status(201).json({
                message: "Question set added successfully",
                questionId,
              });
            }
          );
        }
      );
    }
  );
});

// ...

// Fetch all polls
app.get("/polls", (req, res) => {
  db.query("SELECT * FROM polls", (err, results) => {
    if (err) {
      console.error("Error fetching polls:", err);
      res.status(500).json({ error: "An error occurred while fetching polls" });
      return;
    }

    res.status(200).json({ polls: results });
  });
});

// Update poll details
app.put("/update-poll/:pollId", (req, res) => {
  const pollId = req.params.pollId;
  const { title, category, min_reward, max_reward, start_date, end_date } =
    req.body;

  // Validate input data (ensure that required fields are provided)
  if (
    !title ||
    !category ||
    !min_reward ||
    !max_reward ||
    !start_date ||
    !end_date
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Check if the poll with the given pollId exists
  db.query("SELECT id FROM polls WHERE id = ?", [pollId], (err, results) => {
    if (err) {
      console.error("Error checking poll existence:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while checking poll existence" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Update poll details in the database
    const updatedPoll = {
      title,
      category,
      min_reward,
      max_reward,
      start_date,
      end_date,
    };

    db.query(
      "UPDATE polls SET ? WHERE id = ?",
      [updatedPoll, pollId],
      (updateErr) => {
        if (updateErr) {
          console.error("Error updating poll details:", updateErr);
          return res
            .status(500)
            .json({ error: "An error occurred while updating poll details" });
        }

        res.status(200).json({ message: "Poll details updated successfully" });
      }
    );
  });
});

// Update a question set
app.put("/update-question-set/:pollId/:questionId", (req, res) => {
  const pollId = req.params.pollId;
  const questionId = req.params.questionId;
  const { question_text, options, question_type } = req.body;

  // Validate input data (ensure that required fields are provided)
  if (
    !question_text ||
    !options ||
    !Array.isArray(options) ||
    options.length < 2 ||
    !question_type
  ) {
    return res.status(400).json({ error: "Invalid question set data" });
  }

  // Check if the poll with the given pollId exists
  db.query(
    "SELECT id FROM polls WHERE id = ?",
    [pollId],
    (pollErr, pollResults) => {
      if (pollErr) {
        console.error("Error checking poll existence:", pollErr);
        return res
          .status(500)
          .json({ error: "An error occurred while checking poll existence" });
      }

      if (pollResults.length === 0) {
        return res.status(404).json({ error: "Poll not found" });
      }

      // Check if the question set with the given questionId exists in the specified poll
      db.query(
        "SELECT id FROM questions WHERE id = ? AND poll_id = ?",
        [questionId, pollId],
        (questionErr, questionResults) => {
          if (questionErr) {
            console.error(
              "Error checking question set existence:",
              questionErr
            );
            return res.status(500).json({
              error: "An error occurred while checking question set existence",
            });
          }

          if (questionResults.length === 0) {
            return res
              .status(404)
              .json({ error: "Question set not found in the specified poll" });
          }

          // Update question set details in the database
          const updatedQuestionSet = {
            question_text,
            options: JSON.stringify(options), // Store options as a JSON string
            question_type,
          };

          db.query(
            "UPDATE questions SET ? WHERE id = ?",
            [updatedQuestionSet, questionId],
            (updateErr) => {
              if (updateErr) {
                console.error("Error updating question set:", updateErr);
                return res.status(500).json({
                  error: "An error occurred while updating question set",
                });
              }

              res
                .status(200)
                .json({ message: "Question set updated successfully" });
            }
          );
        }
      );
    }
  );
});

// Fetch user polls and serve questions
app.get("/user-polls/:userId", (req, res) => {
  const userId = req.params.userId;
  const startDate = req.query.start_date; // Optional start date filter
  const endDate = req.query.end_date; // Optional end date filter

  // Check if the user with the given userId exists
  db.query(
    "SELECT id FROM users WHERE id = ?",
    [userId],
    (userErr, userResults) => {
      if (userErr) {
        console.error("Error checking user existence:", userErr);
        return res
          .status(500)
          .json({ error: "An error occurred while checking user existence" });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Construct the SQL query to fetch user polls and questions
      let sqlQuery = `
        SELECT p.id AS poll_id, p.title AS poll_title, p.category AS poll_category,
               p.start_date AS poll_start_date, p.end_date AS poll_end_date,
               COUNT(v.id) AS total_votes
        FROM polls p
        LEFT JOIN votes v ON p.id = v.poll_id AND v.user_id = ?
      `;

      // Optional date filters
      const dateFilter = [];
      if (startDate) {
        dateFilter.push("p.start_date >= ?");
      }
      if (endDate) {
        dateFilter.push("p.end_date <= ?");
      }
      if (dateFilter.length > 0) {
        sqlQuery += ` WHERE ${dateFilter.join(" AND ")}`;
      }

      sqlQuery += `
        GROUP BY p.id, p.title, p.category, p.start_date, p.end_date
        ORDER BY p.start_date ASC
      `;

      // Fetch user polls and their details
      db.query(
        sqlQuery,
        [userId, startDate, endDate],
        (pollErr, pollResults) => {
          if (pollErr) {
            console.error("Error fetching user polls:", pollErr);
            return res
              .status(500)
              .json({ error: "An error occurred while fetching user polls" });
          }

          // Check if there are any polls for the user
          if (pollResults.length === 0) {
            return res
              .status(200)
              .json({ message: "No polls available for the user" });
          }

          // Fetch the first unanswered question for each poll
          const userPolls = [];

          const fetchQuestions = (index) => {
            if (index < pollResults.length) {
              const poll = pollResults[index];

              // Fetch the first unanswered question for the user
              db.query(
                `
              SELECT q.id AS question_id, q.question_text, q.options
              FROM questions q
              WHERE q.poll_id = ? AND q.id NOT IN (
                SELECT v.question_id
                FROM votes v
                WHERE v.user_id = ?
              )
              LIMIT 1
              `,
                [poll.poll_id, userId],
                (questionErr, questionResult) => {
                  if (questionErr) {
                    console.error("Error fetching user question:", questionErr);
                    return res.status(500).json({
                      error: "An error occurred while fetching user questions",
                    });
                  }

                  const userQuestion = questionResult[0] || null;
                  userPolls.push({
                    poll_id: poll.poll_id,
                    poll_title: poll.poll_title,
                    poll_category: poll.poll_category,
                    poll_start_date: poll.poll_start_date,
                    poll_end_date: poll.poll_end_date,
                    total_votes: poll.total_votes,
                    question: userQuestion,
                  });

                  // Continue fetching questions for the next poll
                  fetchQuestions(index + 1);
                }
              );
            } else {
              // All polls and questions fetched, respond with the user's polls
              res.status(200).json(userPolls);
            }
          };

          // Start fetching questions for the first poll
          fetchQuestions(0);
        }
      );
    }
  );
});

// Submit a poll
app.post("/submit-poll/:userId", (req, res) => {
  const userId = req.params.userId;
  const { pollId, questionId, selectedOption } = req.body;

  // Validate input data (ensure that required fields are provided)
  if (!pollId || !questionId || selectedOption === undefined) {
    return res.status(400).json({ error: "Invalid submission data" });
  }

  // Check if the user with the given userId exists
  db.query(
    "SELECT id FROM users WHERE id = ?",
    [userId],
    (userErr, userResults) => {
      if (userErr) {
        console.error("Error checking user existence:", userErr);
        return res
          .status(500)
          .json({ error: "An error occurred while checking user existence" });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the poll with the given pollId exists
      db.query(
        "SELECT id FROM polls WHERE id = ?",
        [pollId],
        (pollErr, pollResults) => {
          if (pollErr) {
            console.error("Error checking poll existence:", pollErr);
            return res.status(500).json({
              error: "An error occurred while checking poll existence",
            });
          }

          if (pollResults.length === 0) {
            return res.status(404).json({ error: "Poll not found" });
          }

          // Check if the question with the given questionId exists in the specified poll
          db.query(
            "SELECT q.id FROM questions q WHERE q.id = ? AND q.poll_id = ?",
            [questionId, pollId],
            (questionErr, questionResults) => {
              if (questionErr) {
                console.error(
                  "Error checking question existence:",
                  questionErr
                );
                return res.status(500).json({
                  error: "An error occurred while checking question existence",
                });
              }

              if (questionResults.length === 0) {
                return res
                  .status(404)
                  .json({ error: "Question not found in the specified poll" });
              }

              // Check if the user has already voted on the same question
              db.query(
                "SELECT v.id FROM votes v WHERE v.user_id = ? AND v.poll_id = ? AND v.question_id = ?",
                [userId, pollId, questionId],
                (voteErr, voteResults) => {
                  if (voteErr) {
                    console.error("Error checking user vote:", voteErr);
                    return res.status(500).json({
                      error: "An error occurred while checking user vote",
                    });
                  }

                  if (voteResults.length > 0) {
                    return res.status(400).json({
                      error: "User has already voted on this question",
                    });
                  }

                  // Validate that the selected option is valid for the question
                  db.query(
                    "SELECT q.options FROM questions q WHERE q.id = ?",
                    [questionId],
                    (optionErr, optionResults) => {
                      if (optionErr) {
                        console.error(
                          "Error fetching question options:",
                          optionErr
                        );
                        return res.status(500).json({
                          error:
                            "An error occurred while fetching question options",
                        });
                      }

                      const questionOptions = JSON.parse(
                        optionResults[0].options
                      );

                      if (!questionOptions.includes(selectedOption)) {
                        return res.status(400).json({
                          error: "Invalid selected option for the question",
                        });
                      }

                      // Calculate a random reward amount within the specified range
                      const minReward = 10; // Define your min reward
                      const maxReward = 50; // Define your max reward
                      const rewardAmount =
                        Math.floor(
                          Math.random() * (maxReward - minReward + 1)
                        ) + minReward;

                      // Store the vote in the database
                      const voteData = {
                        user_id: userId,
                        poll_id: pollId,
                        question_id: questionId,
                        selected_option: selectedOption,
                        reward: rewardAmount,
                      };

                      db.query(
                        "INSERT INTO votes SET ?",
                        voteData,
                        (insertErr) => {
                          if (insertErr) {
                            console.error("Error storing vote:", insertErr);
                            return res.status(500).json({
                              error: "An error occurred while storing vote",
                            });
                          }

                          res.status(200).json({
                            message: "Poll submitted successfully",
                            reward: rewardAmount,
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// Fetch poll analytics for a particular poll
app.get("/poll-analytics/:pollId", (req, res) => {
  const pollId = req.params.pollId;

  // Check if the poll with the given pollId exists
  db.query(
    "SELECT id FROM polls WHERE id = ?",
    [pollId],
    (pollErr, pollResults) => {
      if (pollErr) {
        console.error("Error checking poll existence:", pollErr);
        return res
          .status(500)
          .json({ error: "An error occurred while checking poll existence" });
      }

      if (pollResults.length === 0) {
        return res.status(404).json({ error: "Poll not found" });
      }

      // Fetch poll analytics including total votes and counts of each option
      db.query(
        `
          SELECT
            p.id AS poll_id,
            p.title AS poll_title,
            p.category AS poll_category,
            COUNT(v.id) AS total_votes,
            q.options AS question_options,
            JSON_OBJECTAGG(qo.option_text, COUNT(v.id)) AS option_counts
          FROM polls p
          LEFT JOIN questions q ON p.id = q.poll_id
          LEFT JOIN options qo ON q.id = qo.question_id
          LEFT JOIN votes v ON q.id = v.question_id
          WHERE p.id = ?
          GROUP BY p.id, p.title, p.category, q.options
          `,
        [pollId],
        (analyticsErr, analyticsResults) => {
          if (analyticsErr) {
            console.error("Error fetching poll analytics:", analyticsErr);
            return res.status(500).json({
              error: "An error occurred while fetching poll analytics",
            });
          }

          // Check if there are any analytics for the poll
          if (analyticsResults.length === 0) {
            return res
              .status(200)
              .json({ message: "No analytics available for the poll" });
          }

          // Extract the analytics data
          const pollAnalytics = {
            poll_id: analyticsResults[0].poll_id,
            poll_title: analyticsResults[0].poll_title,
            poll_category: analyticsResults[0].poll_category,
            total_votes: analyticsResults[0].total_votes,
            question_options: JSON.parse(analyticsResults[0].question_options),
            option_counts: JSON.parse(analyticsResults[0].option_counts),
          };

          res.status(200).json(pollAnalytics);
        }
      );
    }
  );
});

// Fetch overall poll analytics
app.get("/overall-poll-analytics", (req, res) => {
  // Fetch overall poll analytics, including total votes and counts of each option
  db.query(
    `
      SELECT
        p.id AS poll_id,
        p.title AS poll_title,
        p.category AS poll_category,
        COUNT(v.id) AS total_votes,
        q.options AS question_options,
        JSON_OBJECTAGG(qo.option_text, COUNT(v.id)) AS option_counts
      FROM polls p
      LEFT JOIN questions q ON p.id = q.poll_id
      LEFT JOIN options qo ON q.id = qo.question_id
      LEFT JOIN votes v ON q.id = v.question_id
      GROUP BY p.id, p.title, p.category, q.options
      `,
    (analyticsErr, analyticsResults) => {
      if (analyticsErr) {
        console.error("Error fetching overall poll analytics:", analyticsErr);
        return res.status(500).json({
          error: "An error occurred while fetching overall poll analytics",
        });
      }

      // Check if there are any analytics available
      if (analyticsResults.length === 0) {
        return res
          .status(200)
          .json({ message: "No overall poll analytics available" });
      }

      // Extract the overall analytics data
      const overallAnalytics = analyticsResults.map((result) => ({
        poll_id: result.poll_id,
        poll_title: result.poll_title,
        poll_category: result.poll_category,
        total_votes: result.total_votes,
        question_options: JSON.parse(result.question_options),
        option_counts: JSON.parse(result.option_counts),
      }));

      res.status(200).json(overallAnalytics);
    }
  );
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
