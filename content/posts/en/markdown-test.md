---
title: Markdown Features Test
date: 2026-05-25T00:00:00.000Z
description: A comprehensive test of all markdown features
tags: [Markdown, Test]
---

## 1. Heading Test

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

---

## 2. Emphasis Test

**Bold text**
*Italic text*
***Bold + Italic***
~~Strikethrough text~~

---

## 3. List Test

### Unordered List
- Item one
- Item two
  - Nested item 2.1
  - Nested item 2.2
- Item three

### Ordered List
1. First item
2. Second item
3. Third item
   1. Nested first
   2. Nested second

### Task List
- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task

---

## 4. Link Test

[Example](https://www.example.com)
[Local file link](./README.md)

---

## 5. Image Test

![Alt text](https://via.placeholder.com/150)

---

## 6. Code Test

### Inline Code
This is an `inline code` example.

### Code Block
```javascript
function hello() {
  console.log("Hello, World!");
}
```

### Code Block (with language identifier)
```python
def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
```

---

## 7. Table Test

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| A1    | B1    | C1    |
| A2    | B2    | C2    |
| A3    | B3    | C3    |

| Left-aligned | Centered | Right-aligned |
|:-------------|:--------:|--------------:|
| text         | text     | text          |
| text         | text     | text          |

---

## 8. Blockquote Test

> This is a blockquote
> It can span multiple lines

> Nested blockquotes
>> Nested level
>>> Deeply nested

---

## 9. Horizontal Rules

---
***
___

---

## 10. Footnote Test

This is a paragraph with a footnote[^1].

[^1]: This is the footnote content.

---

## 11. Emoji

:smile: :rocket: :+1: :heart:

---

## 12. Autolinks

https://www.example.com

email@example.com

---

## 13. Escape Characters

\*asterisks\*
\*\*double asterisks\*\*
\`backticks\`

---

## 14. Complex Nesting

> **Bold inside a blockquote**
> - List item 1
> - List item 2
>   ```javascript
>   // Code block inside a blockquote
>   const x = 1;
>   ```

---

## 15. Rainbow Text

<span style="color:red">R</span><span style="color:orange">a</span><span style="color:yellow">i</span><span style="color:green">n</span><span style="color:blue">b</span><span style="color:indigo">o</span><span style="color:violet">w</span>
