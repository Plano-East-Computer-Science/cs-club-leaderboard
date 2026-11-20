/**
 * Keyword answers: five-letter CS and engineering terms, one per line as
 * `word|one-line definition`. Only these can be the hidden word; guesses are
 * checked against these plus the English list in dict.js.
 */
const RAW = `
abort|Stop a running process or transaction before it finishes.
adder|A digital circuit that adds binary numbers.
admin|An account with full control over a system.
agent|A program that observes its surroundings and acts on its own to reach a goal.
agile|A way of building software in short cycles with frequent feedback.
alert|A browser pop-up that shows a message and waits for the user to close it.
alias|A second name that refers to the same object or memory.
align|Place data at memory addresses that are multiples of its size.
alloy|A metal made by mixing elements, like steel or bronze.
alpha|The opacity channel in an RGBA color.
anode|The electrode where conventional current flows into a device, such as the positive side of a diode.
array|A fixed-size, indexed sequence of elements of one type.
ascii|A 7-bit character code that maps 128 characters to numbers.
asset|A file such as an image, sound or font that a program loads.
async|Code that starts a task and carries on without waiting for it to finish.
audio|Sound stored or sent as a signal.
audit|A review of logs or code to check for security and correctness.
await|Pause an async function until the task it is waiting on completes.
axiom|A statement accepted as true without proof, used to build a theory.
badge|A small UI label that shows a count or a status.
basic|An early programming language designed for beginners.
batch|A group of items processed together, such as a set of training examples.
bayes|Thomas Bayes, whose theorem updates a probability when new evidence arrives.
blame|The git command that shows who last changed each line of a file.
block|A group of statements between braces that forms one unit of scope.
bloom|A Bloom filter: a compact structure that tests set membership, allowing false positives.
board|A circuit board that holds and connects electronic parts.
boole|George Boole, whose algebra of true and false underlies digital logic.
boost|Boosting: combining many weak models into one strong model.
bound|A limit on growth, as in an upper bound in Big-O.
brace|A curly bracket that opens or closes a block of code.
brake|A device that slows motion using friction.
break|Exit the nearest enclosing loop or switch at once.
brute|Brute force: trying every possibility until one works.
build|Turn source code into a program that can run.
cable|Wires bundled together to carry power or data.
cache|Small, fast memory that keeps copies of recently used data.
cargo|Rust's build tool and package manager.
carry|The bit passed to the next column when a binary column sums past 1.
catch|Handle an exception thrown inside a try block.
chain|Separate chaining: keeping colliding hash entries in a linked list.
chart|A picture of data, such as a bar or line graph.
check|A database constraint that rejects rows that fail a condition.
child|A node directly below another node in a tree.
chmod|The Unix command that changes a file's permissions.
class|A blueprint that defines the fields and methods of its objects.
clamp|Limit a value so it stays between a minimum and a maximum.
click|The event fired when a mouse button is pressed and released.
clock|A signal that ticks at a steady rate to keep a circuit in step.
clone|Make a copy of an object or of a git repository.
close|Release a file or connection so the system can reuse it.
cloud|Computing power and storage rented over the internet.
cobol|An old business language still running in many banks.
codec|Software or hardware that encodes and decodes audio or video.
color|A value usually stored as red, green and blue parts.
comma|The separator between arguments, parameters and array elements.
const|A keyword for a variable that cannot be reassigned.
count|A running tally; counting sort tallies how often each key appears.
crank|An arm that turns rotation into back-and-forth motion, or back again.
crash|When a program stops suddenly because of an error.
creep|Slow, permanent stretching of a material under a constant load.
cubic|Growing like n cubed, as a triple nested loop does.
curry|Turn a function of many arguments into a chain of one-argument functions.
cycle|A path in a graph that starts and ends at the same vertex.
datum|A single piece of data; also a reference surface on an engineering drawing.
debug|Find and fix errors in a program.
decay|A gradual decrease, such as learning-rate decay.
delay|The time a signal takes to pass through a gate or wire.
delta|The change in a value, written with the Greek letter delta.
demux|A circuit that routes one input to one of several outputs.
dense|A fully connected neural network layer.
depth|The number of edges from the root of a tree to a node.
deque|A double-ended queue that adds and removes at both ends.
digit|A single symbol in a number, such as 0 to 9 in base ten.
diode|A part that lets current flow in one direction only.
dirty|A dirty cache line has changed but has not been written back yet.
drain|Let a queue or server finish its current work before it shuts down.
drift|A slow, unwanted change in a sensor reading or a clock.
drill|A tool that cuts round holes.
drive|A device that stores data, such as an SSD.
drone|An aircraft flown by remote control or by its own software.
dummy|A placeholder node or value that simplifies code, like a dummy head node.
eager|Doing work right away instead of waiting until it is needed.
email|Electronic mail sent between accounts over a network.
embed|Place one thing inside another; also map words to vectors.
empty|Holding no elements, like an empty list or string.
epoch|One full pass of training over the whole dataset.
epoxy|A strong resin glue used to bond and coat parts.
equal|Having the same value; Java compares objects with equals, not ==.
error|A problem that stops code from compiling or running correctly.
euler|Leonhard Euler; an Euler path uses every edge of a graph exactly once.
event|Something that happens, like a key press, that code can respond to.
evict|Remove an entry from a cache to make room for another.
false|The boolean value meaning no.
farad|The SI unit of capacitance.
fault|An error condition, such as a page fault or a segmentation fault.
fence|A barrier that keeps memory operations from being reordered across it.
fetch|Get data from memory or a server; the first step of the instruction cycle.
fiber|A thin strand of glass that carries data as light.
field|A variable that belongs to an object or a class.
final|A Java keyword for something that cannot be changed or overridden.
fixed|Fixed-point numbers keep a set number of digits after the point.
flash|Memory that keeps its data with the power off.
float|A number type that stores values with a fractional part.
floor|Round down to the nearest whole number.
fluid|A substance that flows, such as a liquid or a gas.
flush|Write buffered data out to its destination right away.
focus|The page element that currently receives keyboard input.
force|A push or pull on an object, measured in newtons.
frame|One image of an animation; also a stack frame for a method call.
front|The end of a queue where elements are removed.
fuzzy|Fuzzy matching finds strings that are close but not exact.
gamma|Gamma correction adjusts brightness so images display evenly.
gauge|An instrument that measures a quantity such as pressure.
gauss|Carl Friedrich Gauss; Gaussian elimination solves systems of equations.
glyph|The drawn shape of a single character in a font.
graph|A set of vertices connected by edges.
group|The SQL GROUP BY clause combines rows that share a value.
guard|A check at the top of a function that returns early.
guest|A visitor without an account, or a virtual machine running on a host.
hertz|The unit of frequency: one cycle per second.
hoare|Tony Hoare, who invented quicksort.
hoist|Move declarations to the top of their scope, as JavaScript does.
hover|When the pointer rests over an element without clicking.
https|HTTP sent over an encrypted connection.
image|A picture stored as pixels; also a packaged container snapshot.
index|The position of an element in an array, counting from zero.
infer|Work out a type, or a prediction, from what is already known.
infix|Notation with the operator between its operands, as in 3 + 4.
inner|An inner join returns only rows that match in both tables.
inode|The Unix record of a file's metadata and where its data lives.
input|Data given to a program.
issue|A tracked bug or task in a project.
items|The Python dict method that returns its key-value pairs.
javac|The Java compiler, which turns source code into bytecode.
joint|A connection between two parts that lets them move, like a hinge.
joule|The SI unit of energy.
julia|A language built for fast numerical computing.
kebab|kebab-case joins words with hyphens, as in my-page-name.
knuth|Donald Knuth, author of The Art of Computer Programming.
label|The correct answer attached to a training example.
laser|A device that emits a narrow beam of coherent light.
lasso|Lasso regression, which can shrink some weights all the way to zero.
latch|A circuit that holds one bit until it is told to change.
layer|One stage of a neural network or of a network protocol stack.
lease|A lock that expires on its own after a set time.
lemma|A small proven result used to prove a bigger theorem.
level|All the nodes of a tree at the same distance from the root.
lever|A bar that pivots on a fulcrum to multiply force.
lexer|The compiler stage that splits source text into tokens.
lidar|A system that measures distance by timing reflected laser light.
limit|The SQL clause that caps how many rows a query returns.
linux|A free, open-source operating system kernel.
local|A variable declared inside a method and visible only there.
logic|Reasoning with true and false; also the gates of a circuit.
login|Sign in to a system by proving who you are.
logit|A model's raw score before it is turned into a probability.
lossy|Compression that throws away some detail to save space, like JPEG.
lower|Python's str.lower(), which returns the text in lowercase.
lumen|The SI unit of luminous flux.
macro|A rule that expands into larger code before compiling.
magic|A magic number: an unexplained constant that should have a name.
match|A match statement compares a value with patterns; a graph matching pairs up vertices.
maven|A build tool that manages Java projects and their libraries.
mealy|A Mealy machine's output depends on its state and its input.
media|CSS media queries change styles based on the screen.
merge|Combine two sorted lists, or two git branches, into one.
meter|An instrument that measures, like a voltmeter; also the SI unit of length.
micro|A prefix meaning one millionth.
mixin|A class that adds methods to other classes without being their parent.
modal|A dialog that blocks the rest of the page until it is closed.
model|A trained function that maps inputs to predictions.
modem|A device that turns digital data into line signals and back.
monad|A functional programming pattern for chaining computations.
moore|A Moore machine's output depends only on its current state.
motor|A machine that turns electrical energy into motion.
mount|Attach a file system so its files can be used.
mouse|A pointing device that moves a cursor on screen.
mutex|A lock that lets only one thread into a critical section at a time.
naive|The simplest approach to a problem, often too slow.
noise|Random variation that hides the signal in data.
nonce|A number used once, as in a cryptographic protocol.
numpy|The Python library for fast arrays and numerical math.
oauth|A standard that lets an app act for a user without seeing their password.
octal|Base eight, written with the digits 0 to 7.
octet|A group of eight bits.
omega|Big-Omega: a lower bound on how fast something grows.
onion|Onion routing wraps data in layers of encryption, as Tor does.
optic|Relating to light, as in an optical fiber or lens.
orbit|The curved path of a satellite around a planet.
order|The SQL ORDER BY clause sorts the results of a query.
outer|An outer join keeps unmatched rows from one or both tables.
owner|The user who owns a file and controls its permissions.
panic|An unrecoverable error that stops a program or a kernel.
parse|Read text and turn it into a structure a program can use.
patch|A small change that fixes or updates code.
paxos|A protocol that lets distributed machines agree on a value.
phase|The position within a wave's cycle, measured as an angle.
phish|Trick someone into giving up secrets with a fake message.
pitch|Rotation about the side-to-side axis, as in pitch, roll and yaw.
pivot|The element quicksort uses to split an array in two.
pixel|The smallest dot of color on a screen.
point|A location in space given by coordinates.
posix|The standard that defines a common Unix-like system interface.
power|Energy per unit time, measured in watts.
prime|A whole number above 1 whose only divisors are 1 and itself.
print|Show output on the screen.
prior|The probability of a hypothesis before new evidence arrives.
prism|A block of glass that splits light into its colors.
probe|Check slot after slot following a hash collision, as in linear probing.
proof|An argument that shows a statement must be true.
props|The inputs a React component receives from its parent.
proxy|A server that forwards requests on behalf of a client.
prune|Cut off branches of a search that cannot lead to a better answer.
pulse|A short burst of signal, as in pulse-width modulation.
qubit|A quantum bit, which can be in a superposition of 0 and 1.
query|A request for data from a database.
queue|A first-in, first-out collection.
quota|A limit on how much of a resource a user may use.
radar|A system that finds objects by bouncing radio waves off them.
radio|Wireless communication using electromagnetic waves.
radix|The base of a number system; radix sort sorts digit by digit.
raise|Python's keyword for throwing an exception.
range|The span of values a loop or a type covers.
ratio|One quantity divided by another.
react|A JavaScript library for building interfaces out of components.
regex|A pattern that matches text, short for regular expression.
relay|A switch opened or closed by an electromagnet.
reset|Put a system back into its starting state.
resin|A liquid that hardens, used in 3D printing and composites.
retro|A meeting at the end of a sprint to reflect and improve.
retry|Try a failed operation again, often after a delay.
ridge|Ridge regression, which shrinks model weights to fight overfitting.
rivet|A metal pin that joins plates permanently.
robot|A machine that senses, decides and acts on its own.
rotor|The spinning part of a motor or generator.
round|Change a number to the nearest whole value.
route|The path a packet or a web request takes.
rover|A robot vehicle that drives across the surface of a planet.
scala|A JVM language that mixes object-oriented and functional styles.
scale|Grow a system so it handles more load.
scanf|The C function that reads formatted input.
scene|The set of objects a game engine draws.
scope|The region of code where a name can be used.
screw|A simple machine: an inclined plane wrapped around a cylinder.
scrum|An agile framework built around short sprints and daily stand-ups.
servo|A motor with feedback that turns to a precise angle.
shaft|A rotating rod that carries power from a motor.
shape|The dimensions of an array or tensor, such as 3 by 4.
shard|One piece of a database that has been split across machines.
shear|Stress that acts parallel to a surface.
shell|A program that reads commands and runs them.
shift|Move the bits of a number to the left or right.
short|A 16-bit integer type in Java.
sigma|The Greek letter used for sums and for standard deviation.
sleep|Pause a thread for a set amount of time.
slice|A section of a list taken by start and end positions.
solar|Powered by energy from the sun.
sonar|A system that locates objects using sound waves.
space|The memory an algorithm needs, as in space complexity.
spawn|Start a new process or thread.
speed|How fast something moves: distance per unit time.
spike|A sudden, short jump in a signal or in traffic.
split|Break a string into pieces around a separator.
spoof|Fake an identity, such as a sender address, to fool a system.
stack|A last-in, first-out collection.
stage|Add changes to the git index before committing them.
stale|Data that is out of date compared with its source.
stall|A pause in a CPU pipeline while it waits for data.
stash|Set aside uncommitted git changes to bring back later.
state|All the values a program or machine holds at one moment.
stdin|The standard input stream a program reads from.
steel|An alloy of iron and carbon.
store|Write a value into memory.
strip|Python's str.strip(), which removes whitespace from both ends.
strut|A rigid bar that resists being squeezed in a frame.
style|CSS rules that set how a page looks.
suite|A group of related tests run together.
super|A keyword that refers to the parent class.
swift|Apple's programming language for its devices.
table|A database structure made of rows and columns.
taint|Mark untrusted input so code can track where it flows.
tesla|The SI unit of magnetic flux density.
theme|A set of colors and styles applied across an app.
theta|Big-Theta: a tight bound on how fast something grows.
throw|Raise an exception.
thunk|A small function that wraps a computation to run later.
timer|A counter that fires an event after a set time.
toast|A small pop-up message that disappears on its own.
token|The smallest meaningful piece of text, like a word or a symbol.
touch|The Unix command that creates an empty file or updates its timestamp.
trace|Follow a program's steps by hand, or a record of those steps.
trait|A set of methods types can share, in languages like Rust and Scala.
train|Fit a model's parameters to data.
truss|A frame of triangles that carries loads efficiently.
tuple|An ordered, fixed-size group of values.
tween|Generate the frames between two keyframes of an animation.
union|Combine two sets; also the union-find structure.
unity|A game engine used to build 2D and 3D games.
unzip|Extract files from a compressed archive.
upper|Python's str.upper(), which returns the text in uppercase.
valve|A device that controls the flow of a fluid.
value|The data stored in a variable.
vault|A secure store for secrets like passwords and keys.
video|Moving pictures stored or sent as data.
virus|Malware that copies itself into other programs.
vocab|The set of all tokens a language model knows.
volta|Alessandro Volta, who built the first battery.
voxel|A 3D pixel: one cube in a volume grid.
wafer|A thin slice of silicon on which chips are made.
watch|A debugger expression whose value is shown as the code runs.
webgl|The browser API for drawing 3D graphics on the GPU.
wedge|A simple machine that splits or lifts objects.
wheel|A simple machine that turns on an axle.
where|The SQL clause that filters rows by a condition.
while|A loop that repeats as long as its condition is true.
whois|A lookup that shows who registered a domain name.
width|The number of bits in a data type, or the size of a tree's widest level.
write|Put data into memory, a file or a stream.
yield|Hand back a value from a generator and pause; also the stress at which metal deforms for good.
zener|A diode built to conduct backward at a set voltage, used as a regulator.
actor|A unit of concurrency that only talks to others by sending messages.
amend|Change the most recent git commit.
angle|An angle bracket, < or >, used in HTML tags and Java generics.
blade|A thin server that slides into a shared chassis.
caret|The ^ character; also the blinking text cursor.
claim|A statement inside a login token, such as the user's id.
clean|Data cleaning: fixing or removing bad records before analysis.
clear|The shell command that wipes the terminal screen.
colon|The : character, which ends an if, for or def line in Python.
crack|Recover a password from its hash by guessing.
crawl|Visit web pages automatically by following their links.
cyber|Relating to computers and networks, as in cybersecurity.
emacs|A programmable text editor first written in the 1970s.
fatal|The log level for errors that stop the program.
flaky|A flaky test passes and fails without any change to the code.
flood|Flood fill: color every connected cell, starting from one point.
forge|Shape hot metal by hammering or pressing it.
grant|Permission given to an app or a user, as in an OAuth grant.
guido|Guido van Rossum, who created Python.
hanoi|The Tower of Hanoi puzzle, solved by recursion in 2^n - 1 moves.
henry|The SI unit of inductance.
joist|A horizontal beam that holds up a floor or ceiling.
lathe|A machine tool that spins a workpiece against a cutting tool.
linus|Linus Torvalds, who created Linux and git.
loose|Loose coupling: parts that depend on each other as little as possible.
mkdir|The shell command that creates a new directory.
nohup|A command that keeps a process running after you log out.
piezo|A material that makes a voltage when squeezed, used in buzzers and sensors.
pinch|A two-finger touch gesture used to zoom.
pylon|A tall tower that holds up power lines.
quote|A ' or " character that starts or ends a string.
recur|Call itself again; a function that does this is recursive.
rsync|A tool that copies files by sending only the parts that changed.
score|A number given to each item so the items can be ranked.
serve|Answer requests from clients over a network.
slash|The / character, used in file paths and for division.
smoke|A smoke test: a quick check that the basics still work.
sniff|Capture network packets as they pass by.
solid|SOLID: five principles of object-oriented design.
spool|Queue work, such as print jobs, to be handled later.
surge|A short spike in voltage that can damage electronics.
swipe|A touch gesture: a quick slide of a finger across the screen.
synth|A synthesizer: an instrument that makes sound electronically.
tilde|The ~ character, which means your home directory in a Unix shell.
topic|A named channel that messages are published to.
trend|The general direction of data over time.
truth|A truth table lists a circuit's output for every possible input.
weber|The SI unit of magnetic flux.
yagni|You aren't gonna need it: do not build features before they are needed.
`;

export const ANSWERS = RAW.trim()
  .split('\n')
  .map((l) => {
    const [word, def] = l.split('|');
    return { word, def };
  });

export const DEFINITION = Object.fromEntries(ANSWERS.map((a) => [a.word, a.def]));
