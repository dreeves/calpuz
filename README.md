# Calendar Puzzle

Arrange the puzzle pieces to reveal the current date.

Forked from <https://github.com/bsoule/CalendarPuzzle>

Hosted at <https://calpuz.dreev.es>

## Notes for the solver

A small subset of the things I wrote down while coaxing the robots to write code for me...

1. Every piece has from the beginning a list of ORIENT/POS pairs indicating how/where it can potentially be placed. Call that the piece's potential placings. For a piece p we write p.pp for p's potential placings.
2. Sort the pieces in the queue by length(pp). The heuristic is to place the most constrained pieces first.
3. Take a piece p from the queue and try every placing i in p.pp.
4. If i yields no unfillable regions, place p according to i and recurse for the next piece in the queue. But before doing so, filter the pp of every other piece q in the queue: for each placing j in q.pp, if j overlaps i, remove j from q.pp.
5. If i does yield unfillable regions, continue to the next element of p.pp.
6. If i yields a region that forces placement of another piece, q, remove everything from q.pp except that placement.

Regions of unfillable size:

Given the grid with some pieces placed so far, use flood-fill to get a list of all the connected regions of vacant cells on the grid.
If any region has a number of cells that not a subset-sum of the sizes of the pieces in the queue, that region is unfillable.

Special case that's pretty much always the case in this puzzle: all the pieces in the queue have size 5 (since they're all pentominoes except for 1 hexomino which we generally place first) so every region's size must be a multiple of 5 to be fillable.

Regions of unfillable shape:

If a region has fewer cells than the sum of the smallest two pieces in the queue, that region must have the same shape as one of the pieces in the queue.
We test if a piece and a region have the same shape by picking a canonical orientation and position and seeing if all their cells coincide.

(Current code actually only checks the shape if the size exactly equals one of the sizes in the queue of pieces. i guess the problem with the current code is that we could (in theory) have a piece that's as big as 2 other pieces combined. say we have a size-2 piece, a size-4 piece, and a size-6 piece in the queue. and supposed there's a size-6 region. it may be that no single piece fits in that region but the size-2 and size-4 piece together do fit.)

Old Tunnel Detection Algorithm: #SCHDEL

1. If there is more than one distinct piece size in the queue of pieces to place, do nothing. (For this puzzle there will often be only pieces of size 5 in the queue. How to generalize this to more than one distinct piece size in the queue is an interesting problem we're setting aside.)
2. Let _uq_ (for "uniform queue") be that size. (Again, typically that's 5 for us.)
3. Call a cell on the grid _vacant_ if it's available to be covered by a piece and is not marked as a _cavity_ (see next).
4. Call a cell on the grid a _cavity_ if it's vacant and has at most 1 vacant neighbor. (Another name for a cavity could be a dead-end but we're defining "cavity" recursively; read on.)
5. Find all cavities. (Finding a cavity may make new cells become cavities but in this step we just find the current cavities.)
6. Call a connected set of cavities a _tunnel_. (Notice how the deep end or nadir of a tunnel is a cavity and marking it as such makes the second-from-the-end a cavity. Iterating, we would mark the whole tunnel as cavity cells.)
7. If a cavity cell has exactly one vacant neighbor, mark that cell as a cavity. (This means we actually also count as part of the tunnel the cell you might think of as just in front of the entrance to the tunnel. The idea is that any piece that will fill this tunnel will, if we haven't hit size uq yet, have to spill out onto this cell as well.)
8. Repeat step 7 _only_ until there exists a tunnel with _uq_ cells. (Note that it's possible for two distinct tunnels to merge while doing this.)
9. If we run out of cavities without finding a uq-sized tunnel, do nothing -- tunnels of size less than uq don't count.
10. If we do find a tunnel of size uq, treat that tunnel as a size-uq region the same way we do for size-5 and size-6 regions.
11. If the tunnel is not fillable by one of the pieces in the queue, mark the cells of the tunnel as unfillable and backtrack.
12. If the tunnel is fillable by a piece, immediately place the piece coincident with the tunnel.

New Tunnel Detection Algorithm:

1. If there is more than one distinct piece size in the queue of pieces to place, do nothing. (For this puzzle there will often be only pieces of size 5 in the queue. How to generalize this to more than one distinct piece size in the queue is an interesting problem we're setting aside.)
2. Let _uq_ (for "uniform queue") be that size. (Again, typically that's 5 for us.)
3. Label every vacant cell with its neighbor count: the number of vacant neighbors it has. 
4. For each cell c that has a neighbor count of 2 (think of c as a bottleneck) call those 2 vacant neighbors nbr1 and nbr2 and do steps 5-10.
5. Do a flood-fill from nbr1, excluding c.
6. If the flood-fill includes nbr2, it is not a valid tunnel. (In this case c was not really a bottleneck.)
7. If the flood-fill is less than size uq, add cell c to it.
8. If it's still less than size uq, add cell nbr2 to it.
9. It's a tunnel if it now has size uq.
10. Repeat steps 5-10 but with nbr1 and nbr2 swapped (nbr2 in step 5, nbr1 in step 8).

Musing (I haven't tried this yet):

There are 8 pieces to place on a grid of 12+31-2=41 initially vacant cells.
Suppose we consider each of those 41 cells to have one of 8 possible colors, initially.
We set the first cell to the first color and then branch to the next cell, also initially the first possible color, and so on.
Each time we pick a color c (and call the piece with color c, p) for a cell, we consider all the ways to place p to cover that cell.
Every cell untouched by any such placement gets c removed from its list of possible colors.

## Notes for the UI

Via Faire:

An annoying thing in this implementation is that sometimes when you click to rotate a shape, it rotates in such a way that it's no longer under the mouse cursor. That means you can't click, say, 3 times in a row to get 270 degrees of rotation. Please make it so rotation happens exactly around the point that's clicked on. Also, snap-to-grid should not happen when rotating, only when dragging.

## Wishlist

1. Pull-to-refresh doesn't work but maybe it shouldn't since that would interfere with panning?
2. More standard zoom in/out icons I guess. For some reason "octicon-zoom-in" and "octicon-zoom-out" aren't working.
3. The solver code is a disaster after endlessly coaxing the robots along.

## Quals (this section by GPT-5.2)

This repo includes a Playwright regression test that checks the invariant that a piece rotates around the point you click/tap.

- Install deps: `npm install`
- Run tests: `npm test`

Playwright runs a local static server (see `playwright.config.js`) and uses Chromium.
