Batch Upload / Download - Quick Instructions

Files created:
- user_upload_template.csv  — CSV template you can open with Excel.

How to use the template
1. Download `user_upload_template.csv` from the project folder.
2. Open it in Excel (or LibreOffice). Edit rows to include all users you plan to upload files for.
   - Required column for automatic mapping: `email` (the uploader will match by this value).
   - Optional columns you can keep: `active`, `first`, `last`, `M.I`, `Suffix`, `role`, `section`, `subject`, `r`.
3. Save your changes. You may either:
   - Keep it as CSV (recommended when uploading), or
   - Save as Excel (.xlsx) if you prefer — but when uploading, export to CSV to ensure uploader parses it correctly.

Mapping options supported by the planned batch uploader
- Filename mapping: files include the user's email in the filename (e.g., "revocayaco@outlook.com_assignment1.pdf").
- CSV mapping (recommended): upload CSV plus PDF files; the CSV's `email` column is authoritative.
- Directory mapping (Chrome): upload a folder where subfolders are user emails/ids.

Next steps I can implement for you (pick any):
- Add a Batch Upload page in the app that accepts the CSV and multiple PDFs, uploads files to Firebase Storage (path: user-files/{role}/{uid}/{filename}), and writes metadata to each user document.
- Add Batch Download: select users/section/role and download a ZIP of their files (client-side zipping with JSZip).

If you want the file as a true .xlsx template instead of CSV, I can produce instructions for converting or integrate a small server-side step to generate .xlsx files. Otherwise, CSV will work with Excel and is simpler.
