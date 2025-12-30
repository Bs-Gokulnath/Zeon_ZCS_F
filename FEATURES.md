# Excel Upload & Table Display Feature

## ✨ How It Works

### 1. Upload Process
- User uploads an Excel/CSV/ZIP file via drag & drop or browse button
- File is sent to: `http://62.72.59.3:8080/process-file`
- Backend processes the file and returns JSON response

### 2. Automatic Table Display
When the upload is **successful**, the JSON response is automatically displayed as a table.

## 📊 Table Display Examples

### Example 1: Array of Objects (Most Common)
**JSON Response:**
```json
[
  {"name": "Charger 1", "status": "Active", "voltage": "240V", "health": "Good"},
  {"name": "Charger 2", "status": "Inactive", "voltage": "240V", "health": "Fair"},
  {"name": "Charger 3", "status": "Active", "voltage": "240V", "health": "Good"}
]
```

**Table Output:**
```
┌────────────┬──────────┬─────────┬────────┐
│    NAME    │  STATUS  │ VOLTAGE │ HEALTH │
├────────────┼──────────┼─────────┼────────┤
│ Charger 1  │  Active  │  240V   │  Good  │
│ Charger 2  │ Inactive │  240V   │  Fair  │
│ Charger 3  │  Active  │  240V   │  Good  │
└────────────┴──────────┴─────────┴────────┘
```

### Example 2: Single Object
**JSON Response:**
```json
{
  "totalChargers": 15,
  "activeChargers": 12,
  "timestamp": "2025-12-25T17:00:00Z",
  "status": "success"
}
```

**Table Output:**
```
┌────────────────┬────────────────┬────────────────────────┬─────────┐
│ TOTAL CHARGERS │ ACTIVE CHARGERS│      TIMESTAMP         │ STATUS  │
├────────────────┼────────────────┼────────────────────────┼─────────┤
│       15       │       12       │ 2025-12-25T17:00:00Z   │ success │
└────────────────┴────────────────┴────────────────────────┴─────────┘
```

## 🎨 Visual Features

1. **Gradient Header** - Purple/Indigo gradient with white text
2. **Alternating Rows** - White and light gray for readability
3. **Hover Effects** - Rows highlight on hover
4. **Scrollable** - Max height 500px with scroll for large data
5. **Nested Objects** - Displayed as formatted JSON in cells
6. **Responsive** - Adapts to different screen sizes

## 🔧 Action Buttons

After results are displayed, you get two buttons:

1. **Download JSON** 📥
   - Downloads the complete JSON response as `result.json`
   
2. **Process Another File** 🔄
   - Clears the results and allows uploading a new file

## 🚀 Testing

To test the feature:

1. Start the frontend: `npm run dev` (already running on port 5175)
2. Open browser: `http://localhost:5175/`
3. Upload an Excel file
4. Watch the table appear automatically with your data!

## 💡 Key Points

- ✅ The table **automatically** renders when upload succeeds
- ✅ Works with **any JSON structure** (objects, arrays, nested data)
- ✅ Headers are **dynamically** generated from JSON keys
- ✅ Column names automatically format (underscores → spaces)
- ✅ No manual configuration needed - just upload and view!
