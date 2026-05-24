export function columnIndexToLabel(col) {
  let label = '';
  let index = col;

  while (index >= 0) {
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26) - 1;
  }

  return label;
}

export function formatCellAddress(row, col) {
  return `${columnIndexToLabel(col)}${row + 1}`;
}
