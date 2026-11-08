# Thanh Nha V25 - Search and mobile cart feedback

Changes: accent-insensitive and case-insensitive search, one-edit typo fallback, 12 results per page; selected product count, clear toast, and editable cart summary above product results.

No database migration is needed. Preserves V24's customer -> items -> payment workflow, combo products and 40,000 VND default shipping.

For truly very large catalogs (e.g. 100,000 products), this limits the rendered DOM but does not paginate Supabase reads. Future large-scale catalog backend should use server-side indexed search and cursor pagination.

Quick checks: add product -> selected count and visible toast; tap twice -> quantity 2; open preview -> plus/minus; search 'HONG SAC PHAO' vs 'hồng sắc pháo'; search a word with one missing letter; item in cart still visible when changing search; DryRun and build.
