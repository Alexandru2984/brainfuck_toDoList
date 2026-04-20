def run_bf(code, input_string):
    tape = [0] * 30000
    ptr = 0
    pc = 0
    input_ptr = 0
    output = []
    
    # Pre-compute jump table for faster loops
    jump_map = {}
    stack = []
    for i, char in enumerate(code):
        if char == '[':
            stack.append(i)
        elif char == ']':
            if not stack:
                raise ValueError(f"Unmatched ']' at position {i}")
            start = stack.pop()
            jump_map[start] = i
            jump_map[i] = start
            
    if stack:
        raise ValueError(f"Unmatched '[' at position {stack.pop()}")

    while pc < len(code):
        char = code[pc]
        
        if char == '>':
            ptr = (ptr + 1) % len(tape)
        elif char == '<':
            ptr = (ptr - 1) % len(tape)
        elif char == '+':
            tape[ptr] = (tape[ptr] + 1) % 256
        elif char == '-':
            tape[ptr] = (tape[ptr] - 1) % 256
        elif char == '.':
            output.append(chr(tape[ptr]))
        elif char == ',':
            if input_ptr < len(input_string):
                tape[ptr] = ord(input_string[input_ptr])
                input_ptr += 1
            else:
                tape[ptr] = 0 # 0 signifies EOF for our BF script
        elif char == '[':
            if tape[ptr] == 0:
                pc = jump_map[pc]
        elif char == ']':
            if tape[ptr] != 0:
                pc = jump_map[pc]
                
        pc += 1
        
    return "".join(output)

if __name__ == "__main__":
    # Small test
    code = "++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++."
    print("Test BF output:", run_bf(code, ""))
