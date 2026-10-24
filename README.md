# PSI Learning: website

This repository is the public website. GitHub Pages publishes the files in it exactly as they are.

```
index.html          the home page: pick a program
capm/index.html     the CAPM program        ->  /capm/
pmp/   cpmai/   pdu/   (later; one folder each)  ->  /pmp/  /cpmai/  /pdu/
assets/             shared files (for example the CAPM Student Handbook PDF)
404.html            the "page not found" page
.nojekyll           tells GitHub to publish the files untouched
```

**One address, one folder per program.** Each program is a folder, and the folder name is the program's address:
`https://<your-address>/capm/`, `/pmp/`, `/cpmai/`, `/pdu/`. The folder names match the `slug` of each program in the database.

**Never put these in this repository (it is public):** quiz questions or answers, flashcards, study guides, student data,
or any key other than the Supabase *publishable* key. The `service_role` key must never appear here.

**Today** the CAPM page is a demonstration with sample questions and nothing is saved. It is replaced by the real,
database-connected version later; the address stays the same.
