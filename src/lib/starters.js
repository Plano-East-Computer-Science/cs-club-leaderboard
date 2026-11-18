/**
 * Starter projects (D7). Each is a short README: what you will have at the end,
 * the steps, and a first file to copy. `repo` is only set where a public GitHub
 * repository is known to exist; otherwise the club's own starter text is the
 * whole starter. Once the in-browser workspace (D2) exists these can open in it.
 */
export const STARTERS = [
  {
    slug: 'discord-bot',
    name: 'Discord bot',
    blurb: 'A bot that answers a command in your own server.',
    time: 'about 2 hours',
    repo: { url: 'https://github.com/discord/discord-example-app', label: 'discord/discord-example-app (Discord\'s own example)' },
    steps: [
      'Make a private Discord server for testing. Do not add the bot to the club server until it works.',
      'Open the Discord developer portal, create an application, add a bot to it and copy its token. Treat the token like a password: it goes in a .env file, never in the repository.',
      'Clone the example app below and follow its README to run it. Check that /test answers in your test server.',
      'Change one command. Good first picks: a /roll dice command, a /quote command that picks from a list, or a /countdown to the next club meeting.',
      'Push it to your own GitHub repository and write one devlog line about what you changed.',
    ],
    file: null,
  },
  {
    slug: 'personal-site',
    name: 'Personal site',
    blurb: 'A one-page site about you, live on the internet for free.',
    time: 'about 1 hour',
    repo: null,
    steps: [
      'Make a new public GitHub repository named your-username.github.io, with a README.',
      'Add a file called index.html and paste the starter below. Commit it.',
      'In the repository settings, open Pages and publish from the main branch. After a minute your site is at https://your-username.github.io.',
      'Change the name, the three things you are working on, and the colors. Add one link to something you built.',
      'Put the address in your project entry. If GitHub is blocked at school, the club gateway reaches it during meetings.',
    ],
    file: {
      name: 'index.html',
      code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Name</title>
  <style>
    body { font: 18px/1.6 system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; }
    a { color: #0a58ca; }
  </style>
</head>
<body>
  <h1>Your Name</h1>
  <p>I go to Plano East and I like building things with code.</p>
  <h2>Working on</h2>
  <ul>
    <li>Something one</li>
    <li>Something two</li>
  </ul>
  <p><a href="https://github.com/your-username">GitHub</a></p>
</body>
</html>`,
    },
  },
  {
    slug: 'data-notebook',
    name: 'Data notebook',
    blurb: 'Load a real dataset, ask it a question, draw one chart.',
    time: 'about 2 hours',
    repo: null,
    links: [
      { url: 'https://colab.research.google.com/', label: 'Google Colab (notebooks in the browser)' },
      { url: 'https://www.kaggle.com/datasets', label: 'Kaggle datasets' },
    ],
    steps: [
      'Open a new notebook in Google Colab. Nothing to install, and it works on school wifi when Google is allowed.',
      'Pick a dataset about something you care about (sports, music, games, school lunch) from Kaggle and upload the CSV file.',
      'Paste the starter below and run it. Read the first rows and the column names.',
      'Write down one question out loud, such as "which month has the most?", and answer it with groupby.',
      'Draw one chart that answers it. Share the notebook link in your devlog.',
    ],
    file: {
      name: 'notebook cell',
      code: `import pandas as pd

df = pd.read_csv("your_file.csv")
print(df.shape)        # rows, columns
print(df.head())       # the first five rows
print(df.describe())   # quick numbers for every numeric column

# Ask one question. Change "column" to a real column name.
print(df.groupby("column").size().sort_values(ascending=False).head(10))
df.groupby("column").size().sort_values(ascending=False).head(10).plot(kind="bar")`,
    },
  },
  {
    slug: 'text-adventure',
    name: 'Text adventure',
    blurb: 'A small story game that runs in the terminal, three rooms to start.',
    time: 'about 1 hour',
    repo: null,
    steps: [
      'Open any Python environment: the club Python runner, your laptop, or Replit-style sites your school allows.',
      'Paste the starter below and run it. Walk through the three rooms.',
      'Add a fourth room and one item the player can pick up.',
      'Make one door locked until the player has the item.',
      'Ask someone in the club to play it and fix the first thing that confuses them.',
    ],
    file: {
      name: 'adventure.py',
      code: `rooms = {
    "hall":    {"text": "A dusty hall. Doors lead north and east.", "exits": {"north": "library", "east": "kitchen"}},
    "library": {"text": "Shelves of old books.", "exits": {"south": "hall"}},
    "kitchen": {"text": "Something smells good.", "exits": {"west": "hall"}},
}

here = "hall"
while True:
    print()
    print(rooms[here]["text"])
    print("Exits:", ", ".join(rooms[here]["exits"]))
    move = input("> ").strip().lower()
    if move == "quit":
        break
    if move in rooms[here]["exits"]:
        here = rooms[here]["exits"][move]
    else:
        print("You can't go that way.")`,
    },
  },
  {
    slug: 'llm-tool',
    name: 'LLM tool',
    blurb: 'A small script that sends text to a language model and uses the answer.',
    time: 'about 2 hours',
    repo: { url: 'https://github.com/anthropics/claude-quickstarts', label: 'anthropics/claude-quickstarts (Anthropic\'s examples)' },
    steps: [
      'Decide on one narrow job: summarize a pasted article, turn notes into flashcards, or explain an error message in plain words.',
      'Get an API key from the provider you use and put it in an environment variable. Never paste it into code or a repository. Ask an officer if you need help with the free options.',
      'Skim the quickstarts below to see how a request is made, then write your own script around your one job.',
      'Write the instructions the model gets as a plain text string and change one sentence at a time. Keep a list of inputs that gave bad answers.',
      'Show one good result and one bad result in your demo. Knowing where it fails is the interesting part.',
    ],
    file: null,
  },
];

export const starterBySlug = (slug) => STARTERS.find((s) => s.slug === slug) ?? null;
