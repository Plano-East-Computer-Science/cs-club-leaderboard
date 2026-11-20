/**
 * Buckets boards: four groups of four, easiest first (difficulty 0 to 3).
 * One group per line as `label|a, b, c, d`; boards are separated by a blank
 * line. Where a tile could fit two groups, the other group must have no
 * other candidates, so every board has exactly one solution.
 */
const RAW = `
Logic gates|AND, OR, XOR, NAND
Sorting algorithms|Merge, Bubble, Quick, Insertion
Data structures|Stack, Queue, Heap, Trie
___ code|Source, Morse, Zip, Pseudo

Java primitive types|int, double, char, boolean
Python data types|list, tuple, dict, set
Git commands|commit, push, clone, stash
Hash ___|Map, Table, Code, Tag

Units in a circuit|Volt, Amp, Ohm, Watt
Programming languages|Python, Java, Rust, Kotlin
Inside a CPU|ALU, Register, Cache, Clock
Stack ___|Overflow, Trace, Frame, Pointer

Image formats|PNG, JPEG, GIF, SVG
Shell commands|ls, cd, grep, mkdir
Object-oriented ideas|Inheritance, Abstraction, Encapsulation, Polymorphism
Web ___|Site, Cam, Hook, Socket

Input devices|Mouse, Microphone, Webcam, Scanner
Output devices|Monitor, Printer, Speaker, Projector
Network hardware|Router, Switch, Modem, Firewall
Has keys|Piano, Lock, Map, Keyboard

Malware|Virus, Worm, Trojan, Spyware
Kinds of testing|Unit, Integration, Smoke, Regression
Agile words|Sprint, Standup, Backlog, Retro
Bit ___|Coin, Map, Mask, Wise

Number bases|Binary, Octal, Decimal, Hex
SQL keywords|SELECT, WHERE, JOIN, GROUP
Computer scientists|Turing, Hopper, Lovelace, Knuth
Graph algorithms|Dijkstra, Prim, Kruskal, BFS

Computer parts|CPU, GPU, RAM, SSD
Data formats|JSON, XML, CSV, YAML
Escape sequences|\\n, \\t, \\", \\\\
Greek letters in CS|Lambda, Sigma, Theta, Omega

Simple machines|Lever, Pulley, Wedge, Screw
Electronic parts|Resistor, Capacitor, Diode, Transistor
Forces|Gravity, Friction, Tension, Drag
Data ___|Base, Set, Frame, Type

Java control flow|for, while, break, continue
In a class header|class, extends, implements, abstract
Java Math methods|abs, pow, sqrt, random
___ loop|Game, Event, Infinite, Feedback

Python built-ins|len, print, range, input
Java String methods|substring, indexOf, charAt, trim
CSS properties|margin, padding, border, display
___ point|Break, Floating, Data, Entry

Network protocols|HTTP, DNS, TCP, UDP
Cyberattacks|Phishing, DDoS, Spoofing, Ransomware
Git words|Commit, Merge, Fork, Pull
Has branches|Tree, River, Bank, Library

Sizes of data|Bit, Nibble, Byte, Word
Unix shells|bash, zsh, sh, fish
Also an animal|Python, Mouse, Bug, Spider
Sorting algorithms|Merge, Quick, Heap, Radix

Design patterns|Singleton, Factory, Observer, Adapter
HTML tags|div, span, img, form
Shell commands|cp, mv, rm, cat
___ ware|Hard, Soft, Firm, Mal

Kinds of energy|Kinetic, Potential, Thermal, Chemical
SI units|Newton, Joule, Watt, Kelvin
Logic gates|NOR, XNOR, NOT, AND
Languages named after people|Ada, Haskell, Pascal, Eiffel

Data structures|Array, Stack, Queue, Graph
Big-O names|Constant, Quadratic, Cubic, Logarithmic
In a computer case|Motherboard, Fan, PSU, Heatsink
___ search|Binary, Linear, Jump, Ternary

Neural network words|Neuron, Layer, Weight, Epoch
Statistics|Mean, Median, Mode, Range
Keyboard keys|Shift, Tab, Escape, Enter
Key ___|Board, Word, Frame, Stroke

Python keywords|def, elif, lambda, import
Web languages|HTML, CSS, JavaScript, PHP
Robot parts|Sensor, Motor, Gripper, Chassis
Things that overflow|Stack, Buffer, Integer, Bathtub

Number bases|Binary, Octal, Decimal, Hex
Hash functions|MD5, SHA-1, SHA-256, bcrypt
Ciphers|AES, RSA, Caesar, Vigenere
___ team in security|Red, Blue, Purple, Tiger

Operating systems|Linux, Windows, macOS, Android
Text editors|Vim, Emacs, Nano, Notepad
File extensions|.java, .py, .js, .html
___ system|File, Number, Solar, Nervous

Java String methods|length, charAt, substring, equals
ArrayList methods|add, remove, size, get
Java Math methods|abs, pow, sqrt, random
SQL aggregates|COUNT, SUM, AVG, MAX

Materials|Steel, Aluminum, Copper, Titanium
Simple machines|Lever, Wheel, Ramp, Pulley
Sensors|Ultrasonic, Infrared, Gyroscope, Encoder
___ board|Mother, Bread, Key, Dash

Women in computing|Lovelace, Hopper, Hamilton, Johnson
Early computers|ENIAC, UNIVAC, Colossus, EDSAC
Started in a garage|Apple, HP, Google, Amazon
Programming paradigms|Functional, Procedural, Declarative, Imperative

Parts of a URL|Protocol, Domain, Path, Query
HTTP methods|GET, POST, PUT, DELETE
Status codes|200, 404, 500, 301
___ request|Pull, Feature, Merge, Friend

Java loops|for, while, do-while, for-each
Kinds of variable|local, instance, static, parameter
Comparison operators|==, !=, <=, >=
Logical operators|&&, ||, !, ^

Tree words|Root, Leaf, Parent, Child
Linked list words|Head, Tail, Node, Next
Git words|Commit, Merge, Stash, Branch
Image formats|PNG, GIF, JPEG, SVG

Social media words|Post, Like, Share, Follow
Spreadsheet words|Cell, Row, Column, Formula
Email words|Inbox, Draft, Spam, Reply
Cloud ___|Storage, Computing, Native, Burst

Kinds of triangle|Scalene, Isosceles, Equilateral, Obtuse
Trig functions|sin, cos, tan, sec
Math constants|Pi, e, Phi, Tau
Right ___|Angle, Click, Shift, Join

Gaming hardware|Controller, Headset, Console, Joystick
Game genres|Platformer, Shooter, Puzzle, Racing
Game dev words|Sprite, Hitbox, Spawn, Level
Power ___|Up, Supply, Point, Shell

Version control|Git, Subversion, Mercurial, Perforce
Package managers|npm, pip, Maven, Cargo
Build steps|Compile, Link, Bundle, Deploy
Pip ___|Install, Line, Squeak, Freeze

Kinds of bridge|Arch, Suspension, Beam, Truss
Building materials|Concrete, Brick, Timber, Glass
Stresses|Tension, Compression, Shear, Torsion
___ load|Dead, Live, Wind, Snow

Units of time|Second, Minute, Hour, Day
Small prefixes|Milli, Micro, Nano, Pico
Big prefixes|Kilo, Mega, Giga, Tera
Clock ___|Speed, Cycle, Signal, Wise

Planets|Mars, Venus, Earth, Jupiter
Space agencies|NASA, ESA, JAXA, ISRO
Rocket parts|Nozzle, Payload, Fairing, Stage
Rockets|Saturn, Falcon, Atlas, Ariane

Printer words|Toner, Ink, Duplex, Spooler
3D printing words|Filament, Nozzle, Layer, Infill
Laser cutter words|Kerf, Focus, Power, Speed
Paper ___|Jam, Clip, Weight, Cut

Data science libraries|pandas, NumPy, Matplotlib, scikit-learn
Chart types|Bar, Pie, Line, Scatter
Statistics words|Mean, Variance, Outlier, Sample
Pie ___|Chart, Crust, Menu, Slice

Kinds of error|Syntax, Runtime, Logic, Compile
Java exceptions|NullPointer, Arithmetic, ClassCast, NumberFormat
Debugging tools|Breakpoint, Debugger, Stack trace, Print
Famous bugs|Y2K, Heartbleed, Therac-25, Ariane 5

Circuit symbols|Battery, Ground, Switch, Bulb
Light parts|LED, Laser, Photodiode, LCD
Ways to connect parts|Solder, Crimp, Screw, Breadboard
Short ___|Circuit, Cut, Hand, Bread

Search engines|Google, Bing, DuckDuckGo, Yahoo
Browsers|Chrome, Firefox, Safari, Edge
Web words|Cache, Session, Token, Header
Also a food|Spam, Java, Chip, Cookie

AP CSA topics|Arrays, ArrayList, Recursion, Inheritance
Java keywords for objects|new, this, super, null
Access levels|public, private, protected, package-private
Methods every object has|toString, equals, hashCode, getClass

Gems|Diamond, Emerald, Sapphire, Opal
Coffee drinks|Espresso, Latte, Mocha, Americano
Coffee ___|Bean, Shop, Table, Break
Programming languages|Ruby, Java, Perl, Go

Network topologies|Star, Ring, Mesh, Bus
Network layers|Physical, Transport, Network, Application
Wireless tech|Wi-Fi, Bluetooth, NFC, Zigbee
IP ___|Address, Phone, Camera, Range

Cybersecurity words|Encryption, Firewall, Antivirus, Patch
Hacker hat colors|White, Black, Gray, Red
Social engineering|Phishing, Pretexting, Baiting, Tailgating
Pass ___|Word, Key, Code, Phrase

Graph properties|Directed, Weighted, Cyclic, Bipartite
Graph words|Vertex, Edge, Degree, Path
Famous graph problems|Coloring, Matching, Shortest path, Max flow
___ graph|Bar, Knowledge, Social, Scene

Machine learning tasks|Classification, Regression, Clustering, Ranking
Model problems|Overfitting, Underfitting, Bias, Leakage
Data splits|Training, Validation, Test, Holdout
Random ___|Forest, Seed, Walk, Access

Drawing views|Front, Top, Side, Isometric
CAD actions|Extrude, Revolve, Fillet, Chamfer
Measuring tools|Caliper, Micrometer, Ruler, Protractor
Hand tools|Wrench, Pliers, Screwdriver, Hammer

Python string methods|upper, lower, split, strip
Python list methods|append, pop, sort, insert
Loop keywords|for, while, break, continue
Python ___|Script, Shell, Package, Notebook

Things with ports|Router, Laptop, Harbor, Airport
Things with tables|Database, Truth, Periodic, Kitchen
Things with keys|Piano, Lock, Map, Keyboard
Things with roots|Tree, Square, Plant, Tooth

Units of storage|Kilobyte, Megabyte, Gigabyte, Terabyte
Storage devices|SSD, Hard drive, USB stick, SD card
Memory types|RAM, ROM, Cache, Register
Flash ___|Drive, Memory, Card, Mob

HTML form inputs|Text, Checkbox, Radio, Range
CSS layout|Flexbox, Grid, Float, Position
JavaScript events|Click, Load, Submit, Keydown
Web ___|Page, Server, Browser, Design

Robotics competitions|FIRST, VEX, BEST, RoboCup
Robot sensors|Lidar, Encoder, Camera, Bumper
Robot drive types|Tank, Mecanum, Swerve, Omni
Gear ___|Ratio, Box, Train, Shift

Recursion words|Base case, Recursive call, Call stack, Unwinding
Loop words|Iteration, Counter, Condition, Update
Variable words|Declare, Assign, Initialize, Scope
Method words|Parameter, Argument, Return, Signature

Algorithms named for people|Dijkstra, Kruskal, Prim, Kadane
Sorting algorithms|Merge, Heap, Counting, Shell
Search algorithms|Binary, Linear, Interpolation, Exponential
Greedy ___|Algorithm, Choice, Coloring, Matching

Written in binary|101, 1000, 1111, 10
Hex digits|A, B, C, F
Powers of two|64, 128, 256, 1024
Invisible ASCII characters|Space, Tab, Newline, Null

AI chatbots|ChatGPT, Gemini, Claude, Copilot
AI words|Prompt, Token, Model, Agent
Image AI words|Pixel, Diffusion, Upscale, Inpaint
Deep ___|Learning, Fake, Mind, Blue

Spreadsheet functions|SUM, AVERAGE, IF, VLOOKUP
Database words|Table, Row, Column, Query
SQL joins|INNER, LEFT, RIGHT, FULL
Primary ___|Key, Color, School, Source

Properties of sound|Pitch, Volume, Tone, Frequency
Audio formats|MP3, WAV, FLAC, AAC
Audio gear|Microphone, Mixer, Amplifier, Speaker
Sound ___|Card, Wave, Check, Barrier

Charged particles|Electron, Proton, Ion, Positron
Semiconductor words|Silicon, Doping, Junction, Wafer
Transistor terminals|Base, Collector, Emitter, Gate
Chip ___|Set, Maker, Shortage, Design

Layers of the Earth|Crust, Mantle, Outer core, Inner core
Network layers|Physical, Data link, Transport, Application
Neural network layers|Input, Hidden, Output, Dense
Layers of a cake|Sponge, Frosting, Filling, Ganache

Tree traversals|Preorder, Inorder, Postorder, Level order
Graph searches|BFS, DFS, A-star, Dijkstra
Kinds of heap|Min, Max, Binary, Fibonacci
Hash collision fixes|Chaining, Probing, Rehashing, Cuckoo

Ways to repeat code|Loop, Recursion, Function, Copy-paste
Ways to store many values|Array, List, Map, Set
Ways to make a choice|if, switch, Ternary, Match
Ways to stop a loop|break, return, Condition, Exception

Physics quantities|Velocity, Acceleration, Momentum, Mass
Electric quantities|Voltage, Current, Resistance, Charge
Energy sources|Solar, Wind, Hydro, Nuclear
___ power|Horse, Will, Super, Fire

Editing shortcuts|Ctrl C, Ctrl V, Ctrl X, Ctrl Z
Function keys|F1, F5, F11, F12
Arrow keys|Up, Down, Left, Right
Space ___|Bar, Station, X, Invaders

Java wrapper classes|Integer, Double, Character, Boolean
Java collections|ArrayList, HashMap, HashSet, LinkedList
Java input and output|Scanner, File, PrintWriter, BufferedReader
Java keywords that are English words|final, super, static, void

Clean code ideas|DRY, KISS, YAGNI, SOLID
Code review words|Approve, Comment, Nitpick, Diff
Git hosting words|Fork, Star, Issue, Release
Rubber ___|Duck, Band, Stamp, Tree

Cloud companies|AWS, Azure, Google Cloud, Oracle
Container words|Docker, Image, Volume, Kubernetes
Server words|Host, Port, Uptime, Load
Server ___|Room, Rack, Farm, Less

Famous algorithms|PageRank, RSA, Quicksort, Huffman
Compression|ZIP, Run-length, LZW, Gzip
Text encodings|ASCII, UTF-8, Base64, Unicode
Morse code|Dot, Dash, SOS, Telegraph

Electric car parts|Battery, Inverter, Motor, Charger
Engine parts|Piston, Crankshaft, Spark plug, Valve
Bike parts|Chain, Derailleur, Pedal, Sprocket
Drive ___|Shaft, Train, Way, Thru
`;

/** [{ groups: [{ label, terms: [4], level }] }], one per board, groups easiest first. */
export const BOARDS = RAW.trim()
  .split(/\n\s*\n/)
  .map((block) => ({
    groups: block
      .trim()
      .split('\n')
      .map((line, level) => {
        const cut = line.indexOf('|'); // first bar only: a tile can be ||
        return { label: line.slice(0, cut), terms: line.slice(cut + 1).split(',').map((t) => t.trim()), level };
      }),
  }));
