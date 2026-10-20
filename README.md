# Dataset Analyzer Website

A local Flask website based on your Python CSV analyzer.

## What it does

Upload a CSV and the site reports:

- Total rows
- Total columns
- Total entries
- Missing data
- Missing values by column
- Column names
- Data types
- Unique values per column
- Exact duplicate values in each column
- Exact duplicate rows
- A small-label/label-value heuristic
- A preview of the first 25 rows

## Run it in VS Code

1. Open this folder in VS Code.
2. Open a terminal.
3. Create a virtual environment (recommended):

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

4. Install the dependencies:

```bash
pip install -r requirements.txt
```

5. Start the website:

```bash
python app.py
```

6. Open the address shown in the terminal, normally:

http://127.0.0.1:5000

## Notes

The original code used an O(n²) nested loop to find duplicate rows. This version uses pandas' `duplicated()` instead, which is much faster for larger datasets.

The analyzer accepts CSV files up to 50 MB by default. You can change `MAX_CONTENT_LENGTH` in `app.py` if needed.
