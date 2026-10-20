from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
from io import StringIO, BytesIO

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

# suggested labels
def suggest_target_columns(data):
    suggestions = []

    target_names = [
        "label", "target", "class", "category",
        "outcome", "result", "prediction", "status",
        "diagnosis", "y"
    ]

    for col in data.columns:
        name = str(col).strip().lower()
        unique_count = data[col].nunique(dropna=True)
        total_rows = len(data)

        if total_rows == 0 or unique_count < 2:
            continue

        reasons = []
        score = 0

        if name in target_names:
            score += 5
            reasons.append("Column name commonly used for targets")

        if unique_count <= 20:
            score += 2
            reasons.append("Contains a relatively small number of classes")

        if data[col].dtype == "object":
            score += 1
            reasons.append("Contains text or categorical values")

        if unique_count / total_rows < 0.2:
            score += 1
            reasons.append("Has relatively few unique values")

        suggestions.append({
            "column": str(col),
            "score": score,
            "unique_values": int(unique_count),
            #"examples": [
            #    str(value)
            #    for value in data[col].dropna().unique()[:5]
            #],
            "reasons": reasons
        })
    return sorted(
        suggestions,
        key=lambda item: item["score"],
        reverse=True
    )




def analyze_csv(file_bytes):
    # latin-1 matches the encoding used in the original analyzer.
    text = file_bytes.decode("latin-1", errors="replace")

    # Read once with pandas. The first row is treated as the header.
    data = pd.read_csv(
        StringIO(text),
        encoding="latin-1",
        on_bad_lines="skip"
    )

    

    fields = [str(c) for c in data.columns]
    rows = data.fillna("").astype(str).values.tolist()

    # Missing values by column.
    missing_by_column = data.isna().sum().to_dict()
    total_missing = int(data.isna().sum().sum())

    # Exact duplicate values in each column.
    duplicate_values = {}
    for col in data.columns:
        duplicate_values[str(col)] = int(data[col].duplicated().sum())

    # Exact duplicate rows.
    duplicate_rows = int(data.duplicated().sum())

    # Unique values across the dataset, matching the intent of the original
    # "labels" set while avoiding a potentially huge Python set.
    labels = set()
    for col in data.columns:
        # Cap this collection so an enormous free-text column does not
        # consume excessive memory.
        for value in data[col].dropna().astype(str).head(10000):
            labels.add(value)

    # The original code only reports labels when the dataset has fewer than 10
    # unique values. This is retained as a useful heuristic.
    detected_labels = sorted(labels) if len(labels) < 10 else []
    target_suggestions = suggest_target_columns(data)
    # Per-column type and cardinality information.
    columns = []
    for col in data.columns:
        series = data[col]
        columns.append({
            "name": str(col),
            "dtype": str(series.dtype),
            "missing": int(series.isna().sum()),
            "unique": int(series.nunique(dropna=True)),
            "target_suggestions": target_suggestions,
            "duplicate_values": int(series.duplicated().sum()),
        })

    # Preview, safely JSON serializable.
    preview_df = data.head(10).copy()
    #preview_df = preview_df.where(pd.notna(preview_df), None)
    preview_df = preview_df.astype(object).where(pd.notna(preview_df), None)
    
    preview = []
    for row in preview_df.to_dict(orient="records"):
        clean_row = {}

        for key, value in row.items():
            if pd.isna(value):
                clean_row[str(key)] = None
            elif isinstance(value, np.generic):
                clean_row[str(key)] = value.item()
            else:
                clean_row[str(key)] = value

        preview.append(clean_row)
    #preview = [
     #  {str(k): (v.item() if isinstance(v, np.generic) else v)
      #  for k, v in row.items()}
       #for row in preview_df.to_dict(orient="records")
    #}
#start gpt
    recommendations = []

    # NEW: Check for missing values
    for col in data.columns:
        missing = int(data[col].isna().sum())
        total_rows = len(data)

        if total_rows > 0 and missing > 0:
            percentage = (missing / total_rows) * 100

            if percentage >= 50:
                recommendations.append({
                    "type": "warning",
                    "title": f"High missing data: {col}",
                    "message": (
                        f"{percentage:.1f}% of this column is missing. "
                        "Consider removing this column or finding a "
                        "reliable way to fill the missing values."
                    )
                })
            else:
                recommendations.append({
                    "type": "info",
                    "title": f"Missing values: {col}",
                    "message": (
                        f"{missing:,} values are missing "
                        f"({percentage:.1f}%). Consider filling or "
                        "removing these missing values."
                    )
                })

    # NEW: Check for duplicate rows
    if duplicate_rows > 0:
        recommendations.append({
            "type": "warning",
            "title": "Duplicate rows detected",
            "message": (
                f"{duplicate_rows:,} exact duplicate rows were found. "
                "Consider removing duplicate rows before using the "
                "dataset for analysis or machine learning."
            )
        })
    target_suggestions = suggest_target_columns(data)

    # NEW: Check repeated values.
    # Label columns are skipped because repeated labels are normal.
    for col in data.columns:

    # Check whether the column contains numeric data
        is_numeric = pd.api.types.is_numeric_dtype(data[col])

    # Don't recommend removing duplicate values from numeric columns
        if is_numeric:
            continue

        duplicate_count = int(data[col].duplicated().sum())

        if duplicate_count > 0:
            recommendations.append({
                "type": "info",
                "title": f"Repeated values: {col}",
                "message": (
                    f"{duplicate_count:,} repeated values were found "
                    "in this non-numeric column. Check whether these "
                    "duplicate values should be removed."
                )
            })

    # NEW: Check for completely empty columns
    for col in data.columns:
        if len(data) > 0 and data[col].isna().all():
            recommendations.append({
                "type": "warning",
                "title": f"Empty column: {col}",
                "message": (
                    "This entire column is empty. Consider removing "
                    "it from the dataset."
                )
            })

    # NEW: Check for columns where every row is unique
    for col in data.columns:
        if len(data) == 0:
            continue

        unique_count = int(data[col].nunique(dropna=True))
        row_count = len(data)

        if unique_count == row_count and row_count > 10:
            recommendations.append({
                "type": "info",
                "title": f"Very high uniqueness: {col}",
                "message": (
                    "Every non-empty value in this column is unique. "
                    "Check whether this is an ID, timestamp, or other "
                    "field that may not be useful for machine learning."
                )
            })

    # NEW: Tell the user when no problems were detected
    if not recommendations:
        recommendations.append({
            "type": "success",
            "title": "Dataset looks clean",
            "message": (
                "No missing values, duplicate rows, or obvious "
                "data-quality problems were detected."
            )
        })
#end gpt
    



    return {
        "filename": "uploaded dataset",
        "rows": int(len(data)),
        "columns": int(len(fields)),
        "fields": fields,
        "total_entries": int(data.size),
        "total_missing": total_missing,
        "missing_by_column": {str(k): int(v) for k, v in missing_by_column.items()},
        "duplicate_rows": duplicate_rows,
        "duplicate_values": duplicate_values,
        "detected_labels": detected_labels,
        "label_count": len(labels),
        "columns_info": columns,
        "preview": preview,
        "recommendations": recommendations,
        "target_suggestions": target_suggestions,

    }



@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    uploaded = request.files.get("dataset")

    if not uploaded or uploaded.filename == "":
        return jsonify({"error": "Please choose a CSV file."}), 400

    if not uploaded.filename.lower().endswith(".csv"):
        return jsonify({"error": "This analyzer currently accepts CSV files only."}), 400

    try:
        result = analyze_csv(uploaded.read())
        result["filename"] = uploaded.filename
        return jsonify(result)
    except Exception as exc:
        return jsonify({
            "error": f"Could not analyze the file: {type(exc).__name__}: {exc}"
        }), 400

@app.route("/visualize", methods=["POST"])
def visualize():
    uploaded = request.files.get("dataset")
    target = request.form.get("target")

    if not uploaded or not target:
        return jsonify({
            "error": "Please select a CSV file and target column."
        }), 400

    try:
        data = pd.read_csv(
            uploaded,
            encoding="latin-1",
            on_bad_lines="skip"
        )

        if target not in data.columns:
            return jsonify({
                "error": "The selected target column was not found."
            }), 400

        # Chart 1: Count each target value, including missing values.
        counts = data[target].astype("object").fillna("(Missing)").value_counts()

        distribution = [
            {"label": str(value), "count": int(count)}
            for value, count in counts.head(20).items()
        ]

        # Encode a binary target as 0/1 for correlation.
        target_values = data[target]
        numeric_target = None

        if pd.api.types.is_numeric_dtype(target_values):
            numeric_target = pd.to_numeric(target_values, errors="coerce")
        elif target_values.nunique(dropna=True) == 2:
            classes = list(target_values.dropna().unique())
            numeric_target = target_values.map({
                classes[0]: 0,
                classes[1]: 1
            })

        correlations = []

        # Chart 2: Correlate numeric features with the target.
        if numeric_target is not None:
            for col in data.select_dtypes(include="number").columns:
                if col == target:
                    continue

                pair = pd.DataFrame({
                    "feature": data[col],
                    "target": numeric_target
                }).dropna()

                if (
                    len(pair) < 2
                    or pair["feature"].nunique() < 2
                    or pair["target"].nunique() < 2
                ):
                    continue

                corr = pair["feature"].corr(pair["target"])

                if pd.notna(corr):
                    correlations.append({
                        "feature": str(col),
                        "correlation": round(float(corr), 4)
                    })

        correlations.sort(
            key=lambda item: abs(item["correlation"]),
            reverse=True
        )

        return jsonify({
            "target": str(target),
            "distribution": distribution,
            "correlations": correlations[:15],
            "correlation_supported": (
                numeric_target is not None
                and numeric_target.nunique() == 2
            )
        })

    except Exception as exc:
        return jsonify({
            "error": f"Visualization failed: {type(exc).__name__}: {exc}"
        }), 400

@app.route("/fix", methods=["POST"])
def fix_dataset():

    uploaded = request.files.get("dataset")

    if not uploaded or uploaded.filename == "":
        return jsonify({
            "error": "No dataset was provided."
        }), 400

    if not uploaded.filename.lower().endswith(".csv"):
        return jsonify({
            "error": "Only CSV files can be fixed."
        }), 400

    try:

        # Read the uploaded dataset
        text = uploaded.read().decode(
            "latin-1",
            errors="replace"
        )

        data = pd.read_csv(
            StringIO(text),
            encoding="latin-1",
            on_bad_lines="skip"
        )

        original_rows = len(data)
        original_columns = len(data.columns)

        # --------------------------------------------------------
        # Remove completely empty columns
        # --------------------------------------------------------

        empty_columns = [
            col for col in data.columns
            if data[col].isna().all()
        ]

        data = data.drop(columns=empty_columns)

        # --------------------------------------------------------
        # Remove exact duplicate rows
        # --------------------------------------------------------

        duplicate_rows_removed = int(data.duplicated().sum())

        data = data.drop_duplicates()

        # --------------------------------------------------------
        # Fill missing values
        # --------------------------------------------------------

        filled_numeric = 0
        filled_text = 0

        for col in data.columns:

            missing_count = int(data[col].isna().sum())

            if missing_count == 0:
                continue

            # Numeric column
            if pd.api.types.is_numeric_dtype(data[col]):

                # Use median so extreme values don't affect
                # the replacement as much as the mean would.
                median_value = data[col].median()

                if pd.notna(median_value):
                    data[col] = data[col].fillna(median_value)
                    filled_numeric += missing_count

            # Text / non-numeric column
            else:

                data[col] = data[col].fillna("Unknown")
                filled_text += missing_count

        # --------------------------------------------------------
        # Create the fixed CSV
        # --------------------------------------------------------

        output = StringIO()

        data.to_csv(
            output,
            index=False
        )

        csv_bytes = output.getvalue().encode("utf-8")

        # Send the corrected CSV back to the browser
        from flask import send_file

        fixed_filename = (
            uploaded.filename.rsplit(".", 1)[0]
            + "_fixed.csv"
        )

        return send_file(
            BytesIO(csv_bytes),
            mimetype="text/csv",
            as_attachment=True,
            download_name=fixed_filename
        )

    except Exception as exc:

        return jsonify({
            "error": (
                f"Could not fix the dataset: "
                f"{type(exc).__name__}: {exc}"
            )
        }), 400

if __name__ == "__main__":
    app.run(debug=True)

