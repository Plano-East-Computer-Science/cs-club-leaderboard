/**
 * Starter CTF challenges (C11). Everything is inline text so nothing needs a live
 * server. Only the SHA-256 of each normalised flag is kept here, never the flag,
 * so reading this file does not solve them. Inserted once by ensureSeeded().
 */
export const STARTERS = [
  {
    "slug": "shift-by-seven",
    "title": "Shift by seven",
    "category": "crypto",
    "difficulty": 1,
    "body": "A note was scrambled by sliding every letter along the alphabet by the same amount. Numbers, braces and underscores were left alone. Undo it to get the flag.",
    "file_name": "note.txt",
    "file_data": "jzjsbi{zopma_if_zlclu}\n",
    "hint": "The flag starts with csclub. How far is c from the first ciphertext letter?",
    "flag_hash": "9a8294323c9114f66ef673e9e596f2cee561bfe383e96f94b77d9c33219ce644"
  },
  {
    "slug": "packed-lunch",
    "title": "Packed lunch",
    "category": "crypto",
    "difficulty": 1,
    "body": "This text looks like noise but it is only a different way of writing bytes. Decode it.",
    "file_name": "lunch.txt",
    "file_data": "Y3NjbHVie2Jhc2U2NF9pc19ub3RfZW5jcnlwdGlvbn0=\n",
    "hint": "The letters, numbers and = at the end are a giveaway. Think base64.",
    "flag_hash": "9e0d7fc9fc51b8eac4d5c61f3d8fb3eab23ad920504705354abb5101561ce71d"
  },
  {
    "slug": "just-bytes",
    "title": "Just bytes",
    "category": "crypto",
    "difficulty": 1,
    "body": "Each pair of characters is one byte written in hexadecimal. Turn the bytes back into text.",
    "file_name": "bytes.txt",
    "file_data": "6373636c75627b6865785f69735f6a7573745f62797465737d\n",
    "hint": "63 is a lowercase c in ASCII.",
    "flag_hash": "b58207dabc0d9ce6bbfd9c9410a61c58767c034f48af70125c7c176740711851"
  },
  {
    "slug": "short-key",
    "title": "Short key",
    "category": "crypto",
    "difficulty": 2,
    "body": "A Vigenere cipher shifts each letter by the matching letter of a repeating key. Only letters move, and the key only advances on letters. The key is four letters and you are in one.",
    "file_name": "message.txt",
    "file_data": "edwmwm{xtafpplf_ytni_c_dbpte_efa}\n",
    "hint": "The key is club. Shift each letter back by its key letter (a is 0).",
    "flag_hash": "85b8192a28194d154de279729451ef6fa16a25c773f62645cbb123e6fd90daec"
  },
  {
    "slug": "one-byte-of-xor",
    "title": "One byte of XOR",
    "category": "crypto",
    "difficulty": 3,
    "body": "Every character was XORed with the same single byte, then written as hex. You are not told the byte, but there are only 256 of them and you know how the flag starts.",
    "file_name": "xor.txt",
    "file_data": "495949465f485145444f7548535e4f75454c7552455857\n",
    "hint": "XOR the first byte with the letter c to recover the key.",
    "flag_hash": "9f720ee97eb33327fec3a451ba3e753643881d5e9e1e9c99e447249b025f8ea1"
  },
  {
    "slug": "needle-in-a-log",
    "title": "Needle in a log",
    "category": "forensics",
    "difficulty": 1,
    "body": "Someone probed the club server and left something odd in one request. Find the request that does not belong.",
    "file_name": "access.log",
    "file_data": "10.0.0.10 - - [18/Nov/2026:15:10:00 +0000] \"GET / HTTP/1.1\" 200 300 \"-\" \"Mozilla/5.0\"\n10.0.1.11 - - [18/Nov/2026:15:11:01 +0000] \"GET /about HTTP/1.1\" 200 337 \"-\" \"Mozilla/5.0\"\n10.0.2.12 - - [18/Nov/2026:15:12:02 +0000] \"GET /join HTTP/1.1\" 200 374 \"-\" \"Mozilla/5.0\"\n10.0.3.13 - - [18/Nov/2026:15:13:03 +0000] \"GET /standings HTTP/1.1\" 200 411 \"-\" \"Mozilla/5.0\"\n10.0.0.14 - - [18/Nov/2026:15:14:04 +0000] \"GET /static/app.css HTTP/1.1\" 200 448 \"-\" \"Mozilla/5.0\"\n10.0.1.15 - - [18/Nov/2026:15:15:05 +0000] \"GET /api/feed HTTP/1.1\" 200 485 \"-\" \"Mozilla/5.0\"\n10.0.2.16 - - [18/Nov/2026:15:16:06 +0000] \"GET /arena HTTP/1.1\" 200 522 \"-\" \"Mozilla/5.0\"\n10.0.3.17 - - [18/Nov/2026:15:17:07 +0000] \"GET /favicon.ico HTTP/1.1\" 200 559 \"-\" \"Mozilla/5.0\"\n10.0.0.18 - - [18/Nov/2026:15:18:08 +0000] \"GET / HTTP/1.1\" 200 596 \"-\" \"Mozilla/5.0\"\n10.0.1.19 - - [18/Nov/2026:15:19:00 +0000] \"GET /about HTTP/1.1\" 200 633 \"-\" \"Mozilla/5.0\"\n10.0.2.20 - - [18/Nov/2026:15:20:01 +0000] \"GET /join HTTP/1.1\" 200 670 \"-\" \"Mozilla/5.0\"\n10.0.3.21 - - [18/Nov/2026:15:21:02 +0000] \"GET /standings HTTP/1.1\" 200 707 \"-\" \"Mozilla/5.0\"\n10.0.0.22 - - [18/Nov/2026:15:22:03 +0000] \"GET /static/app.css HTTP/1.1\" 200 744 \"-\" \"Mozilla/5.0\"\n10.0.1.23 - - [18/Nov/2026:15:23:04 +0000] \"GET /api/feed HTTP/1.1\" 200 781 \"-\" \"Mozilla/5.0\"\n10.0.9.77 - - [18/Nov/2026:15:31:44 +0000] \"GET /static/banner.txt?ref=csclub{grep_finds_needles} HTTP/1.1\" 404 0 \"-\" \"curl/8.4.0\"\n10.0.2.24 - - [18/Nov/2026:15:24:05 +0000] \"GET /arena HTTP/1.1\" 200 818 \"-\" \"Mozilla/5.0\"\n10.0.3.25 - - [18/Nov/2026:15:25:06 +0000] \"GET /favicon.ico HTTP/1.1\" 200 855 \"-\" \"Mozilla/5.0\"\n10.0.0.26 - - [18/Nov/2026:15:26:07 +0000] \"GET / HTTP/1.1\" 200 892 \"-\" \"Mozilla/5.0\"\n10.0.1.27 - - [18/Nov/2026:15:27:08 +0000] \"GET /about HTTP/1.1\" 200 929 \"-\" \"Mozilla/5.0\"\n10.0.2.28 - - [18/Nov/2026:15:28:00 +0000] \"GET /join HTTP/1.1\" 200 966 \"-\" \"Mozilla/5.0\"\n10.0.3.29 - - [18/Nov/2026:15:29:01 +0000] \"GET /standings HTTP/1.1\" 200 1003 \"-\" \"Mozilla/5.0\"\n10.0.0.30 - - [18/Nov/2026:15:30:02 +0000] \"GET /static/app.css HTTP/1.1\" 200 1040 \"-\" \"Mozilla/5.0\"\n10.0.1.31 - - [18/Nov/2026:15:31:03 +0000] \"GET /api/feed HTTP/1.1\" 200 1077 \"-\" \"Mozilla/5.0\"\n10.0.2.32 - - [18/Nov/2026:15:32:04 +0000] \"GET /arena HTTP/1.1\" 200 1114 \"-\" \"Mozilla/5.0\"\n10.0.3.33 - - [18/Nov/2026:15:33:05 +0000] \"GET /favicon.ico HTTP/1.1\" 200 1151 \"-\" \"Mozilla/5.0\"\n",
    "hint": "Search the file for the flag prefix, or look for the one 404.",
    "flag_hash": "6ba1e406822835105daaab8421c6863a6825b15ea585c1cffb8b5b72258dd215"
  },
  {
    "slug": "right-column",
    "title": "The right column",
    "category": "forensics",
    "difficulty": 2,
    "body": "This is a hex dump of a small program. The left side is bytes, the right side shows the printable characters. Something readable was left inside.",
    "file_name": "program.hexdump",
    "file_data": "00000000  7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00  |.ELF............|\n00000010  03 00 3e 00 01 00 00 00 2e 2e 2e 2e 6d 61 69 6e  |..>.........main|\n00000020  2e 63 2e 00 63 73 63 6c 75 62 7b 72 65 61 64 5f  |.c..csclub{read_|\n00000030  74 68 65 5f 72 69 67 68 74 5f 63 6f 6c 75 6d 6e  |the_right_column|\n00000040  7d 00 5f 5f 6c 69 62 63 5f 73 74 61 72 74 5f 6d  |}.__libc_start_m|\n00000050  61 69 6e 00 47 43 43 3a 20 28 44 65 62 69 61 6e  |ain.GCC: (Debian|\n00000060  29 00                                            |).|\n",
    "hint": "Read the text between the pipes, row by row.",
    "flag_hash": "41b88bf4b78d4fa80f50d33b470625cc4a9c475cd3199727f44cb6d0ec2d28c4"
  },
  {
    "slug": "checker-source",
    "title": "Read the checker",
    "category": "reversing",
    "difficulty": 2,
    "body": "This script checks guesses against a hidden flag, but the hidden flag is stored in the script. Work out which input makes check() return True.",
    "file_name": "check.py",
    "file_data": "# check.py: the club's flag checker. It only tells you yes or no.\nSECRET = [100,123,106,107,125,107,124,122,108,102,108,86,115,96,108,88,123,102,114,122,106,98,117]\n\ndef check(guess):\n    if len(guess) != len(SECRET):\n        return False\n    for i, ch in enumerate(guess):\n        if ord(ch) ^ (7 + (i % 3)) != SECRET[i]:\n            return False\n    return True\n",
    "hint": "XOR is its own inverse. Undo the XOR on each number in SECRET.",
    "flag_hash": "a5019ccf301ffb5b8c2236130533a440028799a8abc077843560ef6ebeebf9d9"
  },
  {
    "slug": "cookie-jar",
    "title": "Cookie jar",
    "category": "web",
    "difficulty": 2,
    "body": "This is a saved HTTP response from a demo site. The server stuffed more into a cookie than it should have. No live server is involved. Read the response.",
    "file_name": "response.txt",
    "file_data": "HTTP/1.1 200 OK\nServer: club-demo\nContent-Type: text/html\nSet-Cookie: prefs=eyJ0aGVtZSI6ImRhcmsiLCJsYW5nIjoiZW4iLCJmbGFnIjoiY3NjbHVie25ldmVyX3RydXN0X2FfY29va2llfSJ9; Path=/; HttpOnly\nCache-Control: no-store\n\n<html><body>Welcome back, guest.</body></html>\n",
    "hint": "The prefs cookie is base64 of JSON.",
    "flag_hash": "b1cbe5c56607186b4d475ff4a72465368c774624579bc323cc094f943c0926ca"
  },
  {
    "slug": "dits-and-dahs",
    "title": "Dits and dahs",
    "category": "misc",
    "difficulty": 1,
    "body": "Morse code, with / between words. Decode it, lowercase it, join the words with underscores and wrap it as csclub{...}.",
    "file_name": "signal.txt",
    "file_data": "-.. .. - ... / .- -. -.. / -.. .- .... ...\n",
    "hint": "Dot dash is a. Slash means a space, which becomes an underscore.",
    "flag_hash": "75c784337bbb7fddcd9b3e16d4dd8165f3ffdd093533c01a5a2aec02b7e16f4b"
  }
];
