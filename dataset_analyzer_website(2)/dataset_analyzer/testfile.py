from matplotlib.pylab import rint
import pandas as pd
import csv
import numpy as numpy

filename = "GPT Dataset.csv"  # File name
fields = []  # Column names
rows = []    # Data rows

#gets rows and headers in dataset
with open(filename, 'r') as csvfile:
    csvreader = csv.reader(csvfile)  # Reader object

    fields = next(csvreader)  # Read header
    for row in csvreader:     # Read rows
        rows.append(row)


data = pd.read_csv(filename, encoding='latin-1', on_bad_lines='skip', names=fields)

#find number of missing datapoints
d = {}
for num in range(len(fields)):
    d["missingData{0}".format(num)] = 0

with open(filename, 'r') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        for a in range(len(fields)):
            if row[fields[a]] == '' or row[fields[a]] is None:
                d["missingData{0}".format(a)] += 1

labels = set()
for row in rows:
    for col in row:
        labels.add(col)

print("Number of missing datapoints is: ", sum(d.values()))
#print(d)
print('Field names are: ' + ', '.join(fields))
print("Total no. of rows: %d" % csvreader.line_num)
print("Total entries: ", len(data))
print(f'Number of columns: {len(fields)}')
for b in range(len(fields)-1):
        try:
            eval(rows[0][b])
        except NameError:
            print("Exact duplicate texts in", fields[b],":", data[fields[b]].duplicated().sum())
num=0
for a in range(len(rows)):
    row = rows[a]
    for b in range(len(rows)):
        if(b+a < len(rows)):
            if numpy.array_equal(row,rows[b+a]) and a != b+a: 
                num+=1
print("Duplicated rows:", num)
if len(labels) < 10:  # Adjust the threshold as needed
    print("Labels are: ", labels)