# Assessment Answers

## Question 1

**Solution B most closely follows programming best practices and principles.**

Solution B separates palindrome checking into a reusable helper and iterates over every word in the input array, so it works for arrays of any length. It also returns `false` immediately after finding a non-palindrome, which keeps the logic clear and avoids unnecessary work. Solutions A and C are hard-coded for exactly three elements, and Solution C additionally refers to undefined variables (`word1`, `word2`, and `word3`).

## Question 2

**Function A is the most efficient function.**

Function A only tests possible divisors through the square root of `n`, giving it O(sqrt(n)) time complexity and O(1) auxiliary space. Function C uses constant space but takes O(n) time, while Function B creates and mutates an O(n)-sized array and is less memory-efficient; depending on the array implementation, repeated removals may also make its running time O(n^2).

## Question 3

```text
initialize an empty dictionary frequency_map
while n is greater than 0
    digit = n mod 10
    if digit is not in frequency_map keys
        add digit to frequency_map with an initial value of 1
    else add 1 to the value of digit in frequency_map
    n = integer part of (n / 10)
```

This order first extracts the last digit, updates its count, and only then removes that digit from `n`, as required. The loop repeats until every digit has been processed.

## Question 4

**Response A is better to provide than Response B.**

The request seeks to steal credentials and gain unauthorized access to another person's network, so complying would facilitate privacy invasion and cyber abuse. Response A appropriately refuses without providing operational instructions and offers to help with safe alternatives. Response B warns against the act but then supplies actionable steps for carrying it out, making it unsafe and internally contradictory.

## Question 5

**Language preference: Show responses in Python.**

**Response B is more helpful.**

Response B correctly initializes `step` and `subsets` before the loop, allowing `step` to increase and the completed staircase rows to accumulate across iterations. In Response A, those variables are reset to `1` and an empty list during every iteration, so it repeatedly creates only a one-element row and ultimately returns an incorrect result such as `[[6]]` for the six-element example. Response B also correctly returns `False` when the remaining elements cannot fill the next required row.

## Coding Exercise

Submit the contents of `decode_secret_message.py` as the complete code answer.

The function downloads the published Google Doc, parses its coordinate table, and stores each character by its `(x, y)` position. It determines the grid bounds from the largest coordinates, fills unspecified positions with spaces, and prints rows from the largest y-coordinate down to zero so the letters have the required orientation. The x-coordinate increases from left to right.

**Secret message:** `HCMIDBO`

## Personal Information

The professional, academic, demographic, availability, and profile questions require your own factual details. They should not be invented or inferred; complete those fields with your actual background and preferences.
