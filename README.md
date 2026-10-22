A portfolio website showcasing some of my past work/projects in the software engineering environment.

## Résumé admin

`/admin/` provides a private résumé uploader. The Cloudflare Pages project needs:

- `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` encrypted secrets
- an R2 bucket binding named `RESUMES`

Uploaded PDFs are stored at `resume/resume.pdf` in R2. The public résumé route serves
that object when available and falls back to the checked-in PDF.

The signed-in admin page also controls Floating ASCII site-wide. The setting is
stored in `settings/site.json` in the existing R2 bucket and defaults to off.
Disabled pages contain no effect UI or asset references; effect asset requests
return 404. Changes apply to new page loads. Storage failures keep the effect off.
