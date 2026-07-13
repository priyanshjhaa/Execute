"""Decode a character grid stored in a published Google Doc table."""

from html.parser import HTMLParser
from urllib.request import Request, urlopen


class _TableParser(HTMLParser):
    """Collect the visible text from every cell in every HTML table."""

    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell_parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell_parts = []

    def handle_data(self, data: str) -> None:
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell_parts is not None:
            assert self._row is not None
            self._row.append("".join(self._cell_parts).strip())
            self._cell_parts = None
        elif tag == "tr" and self._row is not None:
            assert self._table is not None
            self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None


def _extract_points(html: str) -> dict[tuple[int, int], str]:
    parser = _TableParser()
    parser.feed(html)

    for table in parser.tables:
        if not table:
            continue
        headers = [header.casefold().strip() for header in table[0]]
        try:
            x_index = headers.index("x-coordinate")
            y_index = headers.index("y-coordinate")
            char_index = headers.index("character")
        except ValueError:
            continue

        points: dict[tuple[int, int], str] = {}
        for row in table[1:]:
            if len(row) <= max(x_index, y_index, char_index):
                continue
            points[(int(row[x_index]), int(row[y_index]))] = row[char_index]
        return points

    raise ValueError("No coordinate table was found in the document")


def print_secret_message(url: str) -> None:
    """Retrieve a published Google Doc and print its decoded character grid."""
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request) as response:
        html = response.read().decode("utf-8")

    points = _extract_points(html)
    if not points:
        return

    max_x = max(x for x, _ in points)
    max_y = max(y for _, y in points)
    for y in range(max_y, -1, -1):
        print("".join(points.get((x, y), " ") for x in range(max_x + 1)).rstrip())


if __name__ == "__main__":
    import sys

    print_secret_message(sys.argv[1])
