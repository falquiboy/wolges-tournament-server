# Bug Report: Wolges Engine Digraph Handling

## Problem
The wolges engine incorrectly generates plays that attempt to overwrite existing digraphs on the board.

## Test Case
1. Round 1: Rack `?O[RR]I[LL]OS` places `[ch]O[RR]I[LL]OS` at H8 horizontal (row 7, col 7-13)
   - The blank (?) is played as [CH] digraph
2. Round 2: Rack `C?SERON` generates `CERONES` at H8 vertical (row 7-13, col 7)
   - This attempts to place C at position (7,7) where [CH] already exists
   - This is INVALID - you cannot overwrite an existing tile

## Current Behavior
- Wolges generates the invalid play as the "optimal" move with 114 points
- Our wrapper now correctly detects and rejects this invalid play
- The game cannot continue because there's no fallback mechanism

## Root Cause
Wolges appears to treat the [CH] digraph incorrectly when:
1. It's a blank played as a digraph (lowercase representation with 0x80 bit)
2. It needs to validate cross-words

The engine seems to think it can place a C "over" or "through" the [CH] digraph.

## Workarounds Needed

### Option 1: Filter Invalid Plays
Modify the wrapper to:
1. Generate multiple plays from wolges (not just the top one)
2. Validate each play before accepting it
3. Return the highest-scoring VALID play

### Option 2: Pre-validation
Before calling wolges, analyze the board and rack to detect potential conflicts with digraphs.

### Option 3: Fix Wolges
The proper solution is to fix the wolges engine itself to correctly handle digraph validation.

## Impact
- Games become unplayable when this situation occurs
- The tournament cannot continue
- Players cannot complete their games

## Temporary Solution Implemented
We've added validation in `apply_play_to_board` that:
1. Detects attempts to overwrite existing tiles
2. Returns an error instead of corrupting the board
3. Prevents the invalid play from being placed

This protects data integrity but doesn't allow the game to continue.