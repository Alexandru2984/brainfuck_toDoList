password = "brainfuck"

bf = ""
# Cell 0: result (49 = '1'), Cell 1: is_wrong (0), Cell 2: temp_input (0)
bf += "+" * 49 + "\n"
bf += ">\n" # move to Cell 1 (is_wrong)

for char in password:
    ascii_val = ord(char)
    bf += "> , " # move to Cell 2 and read
    bf += "-" * ascii_val + " "
    bf += "[ < + > [-] ]\n" # if Cell 2 != 0, increment Cell 1 and zero Cell 2
    bf += "<\n" # move back to Cell 1! So next loop "> ," works correctly!

# Now at Cell 1. Check if there are more characters (password too long)
bf += "> , " # move to Cell 2 and read
bf += "[ < + > , ]\n" # if Cell 2 != 0, increment Cell 1, move back, and read next char

# Now at Cell 2. Move to Cell 1
bf += "<\n"

# Now at Cell 1. If not 0, subtract 1 from Cell 0
bf += "[ < - > [-] ]\n"

# Move to Cell 0 and print
bf += "< .\n"

with open("/home/micu/brainfuck/login.bf", "w") as f:
    f.write(bf)
