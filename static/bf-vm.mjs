/** Byte-accurate Brainfuck machine. No DOM, network, eval, or native execution. */
export const LIMITS = Object.freeze({code: 20000, input: 4096, steps: 2000000, output: 65536, cells: 30000});
export class BrainfuckVM {
    constructor(source, input = "", limits = {}) {
        this.limits = {...LIMITS, ...limits};
        if (typeof source !== "string" || source.length > this.limits.code) throw new Error("Codul depășește limita de 20.000 de caractere.");
        this.input = new TextEncoder().encode(input);
        if (this.input.length > this.limits.input) throw new Error("Inputul depășește limita de 4.096 de octeți.");
        this.code = []; this.positions = []; this.jumps = new Map();
        const stack = [];
        for (let i = 0; i < source.length; i++) {
            const op = source[i];
            if (!"><+-.,[]".includes(op)) continue;
            const pc = this.code.length;
            this.code.push(op); this.positions.push(i);
            if (op === "[") stack.push(pc);
            if (op === "]") {
                if (!stack.length) throw new Error(`Paranteză ] fără pereche la caracterul ${i + 1}.`);
                const start = stack.pop(); this.jumps.set(start, pc); this.jumps.set(pc, start);
            }
        }
        if (stack.length) throw new Error(`Paranteză [ fără pereche la caracterul ${this.positions[stack.pop()] + 1}.`);
        this.tape = new Uint8Array(this.limits.cells);
        this.ptr = 0; this.pc = 0; this.steps = 0; this.inputPtr = 0; this.output = []; this.highWater = 0;
    }
    get done() { return this.pc >= this.code.length; }
    step() {
        if (this.done) return false;
        if (this.steps >= this.limits.steps) throw new Error("Limita de 2.000.000 de pași a fost atinsă. Verifică buclele.");
        switch (this.code[this.pc]) {
            case ">": this.ptr = (this.ptr + 1) % this.tape.length; break;
            case "<": this.ptr = (this.ptr + this.tape.length - 1) % this.tape.length; break;
            case "+": this.tape[this.ptr]++; break;
            case "-": this.tape[this.ptr]--; break;
            case ".":
                if (this.output.length >= this.limits.output) throw new Error("Limita de output: 65.536 de octeți.");
                this.output.push(this.tape[this.ptr]); break;
            case ",": this.tape[this.ptr] = this.input[this.inputPtr++] ?? 0; break;
            case "[": if (!this.tape[this.ptr]) this.pc = this.jumps.get(this.pc); break;
            case "]": if (this.tape[this.ptr]) this.pc = this.jumps.get(this.pc); break;
        }
        this.highWater = Math.max(this.highWater, this.ptr);
        this.pc++; this.steps++;
        return true;
    }
    snapshot() {
        const start = Math.max(0, Math.min(this.ptr - 7, this.tape.length - 16));
        return {pc:this.pc, sourceIndex:this.positions[this.pc] ?? -1, instructions:this.code.length,
            ptr:this.ptr, steps:this.steps, inputPtr:Math.min(this.inputPtr,this.input.length),
            output:this.output, done:this.done, cells:Array.from(this.tape.slice(start,start+16)), start};
    }
    run() { while (this.step()) { /* bounded by step and output limits */ } return Uint8Array.from(this.output); }
}
