import re

# We will take the raw BF code, strip whitespace and comments, and place it into this shape.
# Let's design a brain!

brain_template = """
         _.--\"\"\"\"\"\"--._
       .'          _.-'
      /   _.-'    (
     |  .'         )
     | /           |
      \|           |
       |           |
        \         /
         `-------'
"""
# A bit small for 17k characters. Let's make a huge dense brain or just a cool block.
# Wait, the user wants "in forma de creier, cum ai promis".
# I'll generate a large brain ASCII art and map the BF string to it.

# Let's write a generator for a large brain shape.
def generate_large_brain_mask(width, height):
    # A simple ellipse-like or brain-like mask.
    mask = []
    center_x = width / 2
    center_y = height / 2
    for y in range(height):
        row = ""
        for x in range(width):
            # Equation of an ellipse: (x-cx)^2 / a^2 + (y-cy)^2 / b^2 <= 1
            # Add some sine waves to make it look like a brain's folds (sulci/gyri).
            import math
            dx = x - center_x
            dy = y - center_y
            
            # Simple ellipse boundary
            a = width / 2 - 2
            b = height / 2 - 2
            
            if (dx**2) / (a**2) + (dy**2) / (b**2) <= 1:
                # Inside the main lobe
                row += "#"
            else:
                row += " "
        mask.append(row)
    return mask

# Instead of math, let's use a nice pre-defined ascii art brain.
brain_ascii = r'''
                      _.-""""""-._
                   .'              '.
                  /                  \
                 |                    |
                 |                    |
                  \                  /
                   `._            _.'
                      `----------`
'''
# Even this is too small. We have 17k chars!
# We can repeat the brain, or make one massive brain using scaling.

