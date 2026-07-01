# Serena Global Rules

## Primary Rule

Always use Serena as the primary code navigation and analysis tool.

Do not start by reading files.

---

## Required Workflow

Before any code analysis or modification:

1. activate_project
2. get_symbols_overview
3. find_symbol
4. find_referencing_symbols
5. search_for_pattern
6. read_file only when necessary

---

## File Reading Policy

Never read large files first.

Never scan the entire repository.

Open only files directly related to the task.

Prefer symbols over file contents.

Prefer references over repository-wide searches.

---

## Modification Policy

Before editing:

* Identify affected symbols
* Identify affected references
* Explain root cause

After editing:

* Validate affected code only
* Run minimal required tests

---

## Token Efficiency Rules

Minimize context usage.

Prefer:

* get_symbols_overview
* find_symbol
* find_referencing_symbols
* search_for_pattern

Avoid:

* Reading entire repositories
* Opening unrelated files
* Large context operations

---

## Preferred Serena Tools

Priority order:

1. activate_project
2. get_symbols_overview
3. find_symbol
4. find_referencing_symbols
5. search_for_pattern
6. read_file
7. replace_symbol_body

Use read_file only after symbol discovery.

Serena should be used before any filesystem exploration whenever available.
