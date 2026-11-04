import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {BrainfuckVM, LIMITS} from "../static/bf-vm.mjs";
import {examples, challenges} from "../static/catalog.mjs";
const decode=bytes=>new TextDecoder().decode(bytes);
const source=async file=>(await readFile(new URL(`../static/programs/${file}`,import.meta.url))).toString();
for(const example of examples){
    test(`example ${example.id} executes within its budget`,async()=>{
        const machine=new BrainfuckVM(await source(example.file),example.input);
        const output=machine.run();
        const expected={hello:"Hello World!\n",echo:"Salut, Brainfuck!",sum:"5",multiply:"6",reverse:"kcufniarb",count:"9",upper:"BRAINFUCK",alphabet:"abcdefghijklmnopqrstuvwxyz",transfer:""};
        if(example.id==="bytes")assert.deepEqual([...output],Array.from({length:255},(_,i)=>i+1));
        else assert.equal(decode(output),expected[example.id]);
    });
}
for(const challenge of challenges){
    test(`reference solution passes every case: ${challenge.id}`,async()=>{
        const code=challenge.id==="letter"?"+".repeat(65)+".":await source(examples.find(e=>e.id===challenge.id).file);
        for(const sample of challenge.cases)assert.equal(decode(new BrainfuckVM(code,sample.input).run()),sample.expected);
    });
}
test("loops, EOF, 8-bit cells and pointer wrap",()=>{
    assert.deepEqual([...new BrainfuckVM("-.+.").run()],[255,0]);
    assert.deepEqual([...new BrainfuckVM("<+.>.<.").run()],[1,0,1]);
    assert.deepEqual([...new BrainfuckVM(",.,.","A").run()],[65,0]);
    assert.equal(decode(new BrainfuckVM("comment +++[>++<-]>.").run()),String.fromCharCode(6));
});
test("UTF-8 input stays byte-accurate",()=>assert.equal(decode(new BrainfuckVM(",[.,]","Salut, 🧠").run()),"Salut, 🧠"));
test("step exposes current instruction and tape without executing extra steps",()=>{
    const machine=new BrainfuckVM("xx+>++.");machine.step();
    assert.equal(machine.steps,1);assert.equal(machine.tape[0],1);assert.equal(machine.snapshot().sourceIndex,3);
    machine.run();assert.equal(machine.snapshot().done,true);assert.equal(machine.step(),false);
});
test("malformed loops, oversize input and resource exhaustion are bounded",()=>{
    for(const code of ["[","]","[[]"])assert.throws(()=>new BrainfuckVM(code));
    assert.throws(()=>new BrainfuckVM("x".repeat(LIMITS.code+1)));
    assert.throws(()=>new BrainfuckVM("","🧠".repeat(1025)));
    assert.throws(()=>new BrainfuckVM("+[]","",{steps:100}).run());
    assert.throws(()=>new BrainfuckVM("...","",{output:2}).run());
});
