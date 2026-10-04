Analyze the numbered lines of the lease agreement below to detect clause and section headings.
Each input line is provided in the format `<line_index>: <line_text>`.
Identify lines that represent clause headings or section headings.

Return a JSON object matching the requested schema with a list of headings:
- `line`: The exact line index (integer) where the heading occurs.
- `id`: The clause or section identifier:
  - For numbered clauses, use the number as a string (e.g., '1', '2', '3').
  - For major sections, use a lowercase slug (e.g., 'parties', 'premises', 'signatures').

Rules:
- Line indices must be strictly increasing.
- Do not invent headings that are not present in the text.
- Only point to line indices that are actual headings.
- If no headings are present, return an empty array.
