const input = document.getElementById("datasetInput");
const form = document.getElementById("uploadForm");
const dropZone = document.getElementById("dropZone");
const fileName = document.getElementById("fileName");
const statusBox = document.getElementById("status");
const results = document.getElementById("results");
const uploadCard = document.getElementById("uploadCard");
const analyzeButton = document.getElementById("analyzeButton");

input.addEventListener("change", () => {
    updateFileName(input.files[0]);
});

function updateFileName(file) {
    fileName.textContent = file ? file.name : "No file selected";
}

["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.add("dragging");
    });
});

["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.remove("dragging");
    });
});

dropZone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (!file) return;

    // DataTransfer lets the normal form submission use the dropped file.
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    updateFileName(file);
});

form.addEventListener("submit", async e => {
    e.preventDefault();

    const file = input.files[0];
    if (!file) {
        showStatus("Choose a CSV file first.", true);
        return;
    }

    const formData = new FormData();
    formData.append("dataset", file);

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analyzing...";
    showStatus("Reading and analyzing your dataset...");

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Analysis failed.");
        }

        renderResults(result);
        results.classList.remove("hidden");
        results.scrollIntoView({ behavior: "smooth", block: "start" });
        showStatus("");
    } catch (error) {
        showStatus(error.message, true);
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Analyze Dataset";
    }
});

document.getElementById("newAnalysis").addEventListener("click", () => {
    results.classList.add("hidden");
    uploadCard.scrollIntoView({ behavior: "smooth" });
});

function showStatus(message, error = false) {
    statusBox.textContent = message;
    statusBox.className = error ? "status error" : "status";
}

function number(value) {
    return Number(value).toLocaleString();
}

function renderTargetSuggestions(data) {
    const section = document.getElementById("targetSuggestionsSection");
    const select = document.getElementById("targetColumnSelect");
    const list = document.getElementById("targetSuggestionsList");

    if (!section || !select || !list) return;

    // All suggestions for the dropdown
    const allSuggestions = data.target_suggestions || [];

    // Only the top 5 suggestions for the displayed cards
    const topSuggestions = allSuggestions.slice(0, 5);

    section.style.display = "block";
    select.innerHTML = '<option value="">No target selected</option>';
    list.innerHTML = "";

    // Populate dropdown with ALL suggestions
    allSuggestions.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.column;
        option.textContent =
            `${item.column} — ${item.unique_values} unique values`;
        select.appendChild(option);
    });

    // Display only the TOP 5 suggestion cards
    topSuggestions.forEach((item) => {
        const card = document.createElement("div");
        card.className = "target-suggestion";

        const title = document.createElement("strong");
        title.textContent = item.column;

        const details = document.createElement("small");
        details.textContent =
            `Score: ${item.score} | Unique values: ${item.unique_values}`;

        card.append(title, details);
        list.appendChild(card);
    });
}

function renderResults(data) {
    document.getElementById("datasetTitle").textContent = data.filename;
    document.getElementById("rows").textContent = number(data.rows);
    document.getElementById("columns").textContent = number(data.columns);
    document.getElementById("entries").textContent = number(data.total_entries);
    document.getElementById("missing").textContent = number(data.total_missing);
    document.getElementById("duplicates").textContent = number(data.duplicate_rows);
    document.getElementById("uniqueValues").textContent = number(data.label_count);

    //renderMissing(data);
    //renderLabels(data);
    renderColumns(data);
    renderPreview(data);
    renderRecommendations(data);
    renderFixButton(data);
    renderTargetSuggestions(data);
    
}

function renderFixButton(data) {

    const fixSection = document.getElementById("fixSection");

    /*
     * Only show the button for problems that the fixer can
     * actually correct.
     *
     * Repeated values are intentionally NOT included.
     */

    const hasMissingValues = data.total_missing > 0;

    const hasDuplicateRows = data.duplicate_rows > 0;

    const hasEmptyColumns = data.columns_info.some(
        column => column.missing === data.rows && data.rows > 0
    );

    if (
        hasMissingValues ||
        hasDuplicateRows ||
        hasEmptyColumns
    ) {
        fixSection.classList.remove("hidden");
    } else {
        fixSection.classList.add("hidden");
    }
}

// ============================================================
// ===== NEW: FIX DATASET BUTTON =====
// ============================================================

document.getElementById("fixDatasetButton").addEventListener(
    "click",
    async () => {

        const file = input.files[0];

        if (!file) {
            alert("Please select your dataset again.");
            return;
        }

        const button = document.getElementById(
            "fixDatasetButton"
        );

        const status = document.getElementById(
            "fixStatus"
        );

        button.disabled = true;
        button.textContent = "Fixing Dataset...";

        status.textContent =
            "Applying safe fixes to your dataset...";

        try {

            const formData = new FormData();

            formData.append(
                "dataset",
                file
            );

            const response = await fetch(
                "/fix",
                {
                    method: "POST",
                    body: formData
                }
            );

            if (!response.ok) {

                let message = "Unable to fix dataset.";

                try {
                    const error = await response.json();
                    message = error.error || message;
                } catch {}

                throw new Error(message);
            }

            // Get the corrected CSV
            const blob = await response.blob();

            // Create a download link
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;

            link.download =
                file.name.replace(
                    /\.csv$/i,
                    "_fixed.csv"
                );

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);

            status.textContent =
                "Fixed dataset downloaded successfully.";

        } catch (error) {

            status.textContent =
                error.message;

        } finally {

            button.disabled = false;

            button.textContent =
                "Fix Dataset & Download";
        }
    }
);

function renderRecommendations(data) {
    const container = document.getElementById("recommendations");

    if (!data.recommendations || data.recommendations.length === 0) {
        container.innerHTML = `
            <div class="recommendation success">
                <div class="recommendation-icon">✓</div>
                <div>
                    <strong>No recommendations</strong>
                    <p>Your dataset looks good based on the checks performed.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = data.recommendations.map(rec => `
        <div class="recommendation ${rec.type}">
            <div class="recommendation-icon">
                ${getRecommendationIcon(rec.type)}
            </div>

            <div>
                <strong>${escapeHtml(rec.title)}</strong>
                <p>${escapeHtml(rec.message)}</p>
            </div>
        </div>
    `).join("");
}

function getRecommendationIcon(type) {
    if (type === "warning") return "!";
    if (type === "success") return "✓";
    return "i";
}
//function recommendations(data) {
//    if(number(data.total_missing) > 0){
        
  //  }

//}

function renderMissing(data) {
    const container = document.getElementById("missingBars");
    const entries = Object.entries(data.missing_by_column);

    if (!entries.length) {
        container.innerHTML = '<p class="muted">No columns found.</p>';
        return;
    }

    const max = Math.max(...entries.map(([, value]) => value), 1);

    container.innerHTML = entries.map(([name, value]) => `
        <div class="bar-row">
            <div class="bar-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(value / max) * 100}%"></div>
            </div>
            <div class="bar-value">${number(value)}</div>
        </div>
    `).join("");
}

function renderLabels(data) {
    const container = document.getElementById("labels");

    if (!data.detected_labels.length) {
        container.innerHTML = '<p class="muted">More than 9 unique values were found, so no small label set was displayed.</p>';
        return;
    }

    container.innerHTML = `
        <div class="label-list">
            ${data.detected_labels.map(label => `<span class="label">${escapeHtml(label)}</span>`).join("")}
        </div>
    `;
}

function renderColumns(data) {
    const body = document.getElementById("columnTable");
    document.getElementById("columnCount").textContent = `${data.columns} columns`;

    body.innerHTML = data.columns_info.map(col => `
        <tr>
            <td><strong>${escapeHtml(col.name)}</strong></td>
            <td>${escapeHtml(col.dtype)}</td>
            <td>${number(col.missing)}</td>
            <td>${number(col.unique)}</td>
            <td>${number(col.duplicate_values)}</td>
        </tr>
    `).join("");
}

function renderPreview(data) {
    const table = document.getElementById("previewTable");

    if (!data.preview.length) {
        table.innerHTML = "<tbody><tr><td>No rows to display.</td></tr></tbody>";
        return;
    }

    const columns = Object.keys(data.preview[0]);

    table.innerHTML = `
        <thead>
            <tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
        </thead>
        <tbody>
            ${data.preview.map(row => `
                <tr>
                    ${columns.map(col => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


let targetDistributionChart = null;
let featureCorrelationChart = null;
function resetTargetVisualization() {
    const visualization = document.getElementById("targetVisualization");
    const targetSelect = document.getElementById("targetColumnSelect");
    const message = document.getElementById("correlationMessage");

    // Hide charts from the previously uploaded dataset.
    if (visualization) {
        visualization.classList.add("hidden");
    }

    // Destroy old charts before creating charts for another dataset.
    if (targetDistributionChart) {
        targetDistributionChart.destroy();
        targetDistributionChart = null;
    }

    if (featureCorrelationChart) {
        featureCorrelationChart.destroy();
        featureCorrelationChart = null;
    }

    // Clear the previous target selection.
    if (targetSelect) {
        targetSelect.value = "";
    }

    // Reset the status message.
    if (message) {
        message.textContent = "Select a target column to display the charts.";
    }
}

// Reset the visuals whenever a new CSV file is selected.
document.getElementById("datasetInput")?.addEventListener(
    "change",
    resetTargetVisualization
);

async function updateTargetVisualization() {
    const targetSelect =
        document.getElementById("targetColumnSelect");

    // This is the actual upload input ID in your HTML.
    const fileInput = document.getElementById("datasetInput");

    if (!targetSelect || !fileInput || !fileInput.files.length) {
        return;
    }

    const target = targetSelect.value;
const visualization = document.getElementById("targetVisualization");

if (!target) {
    // Hide the entire visualization section.
    visualization.classList.add("hidden");

    // Destroy existing charts so they don't remain in memory.
    if (targetDistributionChart) {
        targetDistributionChart.destroy();
        targetDistributionChart = null;
    }

    if (featureCorrelationChart) {
        featureCorrelationChart.destroy();
        featureCorrelationChart = null;
    }
    

    return;
}

// Show the graphs only after a target is selected.
visualization.classList.remove("hidden");

    const formData = new FormData();
    formData.append("dataset", fileInput.files[0]);
    formData.append("target", target);

    const message = document.getElementById("correlationMessage");
    message.textContent = "Updating charts...";

    try {
        const response = await fetch("/visualize", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not create charts.");
        }

        // Chart 1: Target distribution
        if (targetDistributionChart) {
            targetDistributionChart.destroy();
        }

        targetDistributionChart = new Chart(
            document.getElementById("targetDistributionChart"),
            {
                type: "doughnut",
                data: {
                    labels: data.distribution.map(item => item.label),
                    datasets: [{
                        label: "Number of rows",
                        data: data.distribution.map(item => item.count)
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { color: "#eef3ff" }
                        },
                        tooltip: {
                            callbacks: {
                                label: context => {
                                    const total = context.dataset.data
                                        .reduce((sum, value) => sum + value, 0);
                                    const count = context.raw;
                                    const percent = total
                                        ? (count / total * 100).toFixed(1)
                                        : "0.0";

                                    return `${context.label}: ${count.toLocaleString()} (${percent}%)`;
                                }
                            }
                        }
                    }
                }
            }
        );

        // Chart 2: Feature correlation
        if (featureCorrelationChart) {
            featureCorrelationChart.destroy();
            featureCorrelationChart = null;
        }

        if (!data.correlation_supported) {
            message.textContent =
                "Correlation is available here for numeric or binary targets. " +
                "This target has more than two categories or is not suitable " +
                "for binary correlation.";
            return;
        }

        if (!data.correlations.length) {
            message.textContent =
                "No suitable numeric feature columns were found to compare " +
                "with this target.";
            return;
        }

        message.textContent =
            "Closer to +1 or -1 means a stronger linear relationship; " +
            "values near 0 indicate a weaker linear relationship. " +
            "Correlation does not prove causation.";

        featureCorrelationChart = new Chart(
            document.getElementById("featureCorrelationChart"),
            {
                type: "bar",
                data: {
                    labels: data.correlations.map(item => item.feature),
                    datasets: [{
                        label: "Correlation",
                        data: data.correlations.map(
                            item => item.correlation
                        )
                    }]
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    scales: {
                        x: {
                            min: -1,
                            max: 1,
                            ticks: { color: "#9aa8c2" },
                            grid: { color: "#293653" },
                            title: {
                                display: true,
                                text: "Correlation (-1 to +1)",
                                color: "#eef3ff"
                            }
                        },
                        y: {
                            ticks: { color: "#eef3ff" },
                            grid: { color: "#293653" }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            }
        );
    } catch (error) {
        message.textContent = error.message;
    }
}

// Update charts whenever the selected target changes.
document.getElementById("targetColumnSelect")?.addEventListener(
    "change",
    updateTargetVisualization
);


