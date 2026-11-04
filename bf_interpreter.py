from functools import lru_cache


@lru_cache(maxsize=32)
def compile_bf(code):
    if len(code) > 200_000:
        raise ValueError("Brainfuck source is too large")
    code = "".join(c for c in code if c in "><+-.,[]")
    jumps = {}
    stack = []
    for i, char in enumerate(code):
        if char == "[":
            stack.append(i)
        elif char == "]":
            if not stack:
                raise ValueError(f"Unmatched ']' at position {i}")
            start = stack.pop()
            jumps[start] = i
            jumps[i] = start
    if stack:
        raise ValueError(f"Unmatched '[' at position {stack.pop()}")
    return code, jumps


def run_bf(code, input_string, max_steps=1_000_000, max_output=50_000):
    if len(input_string) > 100_000 or any(ord(c) > 255 for c in input_string):
        raise ValueError("Brainfuck input must be a bounded byte string")
    code, jump_map = compile_bf(code)
    tape = [0] * 30000
    ptr = 0
    pc = 0
    input_ptr = 0
    output = []
    steps = 0

    while pc < len(code):
        steps += 1
        if steps > max_steps:
            raise TimeoutError(f"Brainfuck step limit exceeded ({max_steps})")

        char = code[pc]

        if char == ">":
            ptr = (ptr + 1) % len(tape)
        elif char == "<":
            ptr = (ptr - 1) % len(tape)
        elif char == "+":
            tape[ptr] = (tape[ptr] + 1) % 256
        elif char == "-":
            tape[ptr] = (tape[ptr] - 1) % 256
        elif char == ".":
            output.append(chr(tape[ptr]))
            if len(output) > max_output:
                raise ValueError(f"Brainfuck output limit exceeded ({max_output})")
        elif char == ",":
            if input_ptr < len(input_string):
                tape[ptr] = ord(input_string[input_ptr])
                input_ptr += 1
            else:
                tape[ptr] = 0  # 0 signifies EOF for our BF script
        elif char == "[":
            if tape[ptr] == 0:
                pc = jump_map[pc]
        elif char == "]" and tape[ptr] != 0:
            pc = jump_map[pc]

        pc += 1

    return "".join(output)


if __name__ == "__main__":
    # Small test
    code = "++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++."
    print("Test BF output:", run_bf(code, ""))
