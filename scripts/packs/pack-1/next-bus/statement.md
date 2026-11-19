The city bus stops in front of school at the same times every day. You know the time now and the list of bus times. How many minutes until the next bus?

The next bus is the first one that leaves at or after the current time. If every bus today has already left, the next bus is the first one tomorrow.

## Input

The first line has the current time as HH:MM. The second line has N, the number of buses. Each of the next N lines has one bus time as HH:MM. The bus times are in no particular order and can repeat.

## Output

Print one integer: the number of minutes from now until the next bus.

## Constraints

- Times use the 24-hour clock, from 00:00 to 23:59, always with two digits for the hour and two for the minutes.
- 1 ≤ N ≤ 1,000
