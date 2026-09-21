from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder = root / 'tmp/selection-qa'
folder.mkdir(parents=True, exist_ok=True)
font = Path('C:/Windows/Fonts/malgun.ttf')
if not font.exists():
    font = root / 'assets/fonts/NanumJaBuSimJiU.ttf'
pdfmetrics.registerFont(TTFont('Korean', str(font)))
c = canvas.Canvas(str(folder / 'source.pdf'), pagesize=(700, 450))
c.setFont('Korean', 14)
c.drawString(24, 418, '글자 선택과 여러 줄 표시 검증')
c.setFont('Korean', 10)
# Deliberately paint table cells out of reading order, as many generated PDFs do.
for n, y in [('441', 370), ('442', 302), ('443', 236)]:
    c.drawString(50, y, n)
    c.drawString(604, y, '50만원')
for text, y in [
    ('간호·간병통합서비스사용일반상해입원일당(1일이상180일한도)', 382),
    ('통합간편가입 일반상해로 입원하여 치료받은 경우 지급합니다.', 370),
    ('보장 내용은 약관을 확인해 주세요. gjpqy 12345', 358),
    ('여러 줄을 드래그한 형광펜은 한 번에 색을 바꿉니다.', 314),
    ('두 번째 줄도 같은 묶음으로 선택하고 지울 수 있습니다.', 302),
    ('단어 더블클릭 테스트 문장입니다.', 248),
    ('취소와 확대 및 다른 도구 전환을 확인합니다.', 214),
]: c.drawString(100, y, text)
c.setStrokeColorRGB(.75, .75, .75)
for y in (398, 345, 333, 289, 268, 224): c.line(35, y, 675, y)
for x in (35, 90, 590, 675): c.line(x, 200, x, 398)
c.showPage(); c.save()
reader = PdfReader(folder / 'source.pdf')
writer = PdfWriter()
for rotation in (0, 90, 180, 270):
    p = writer.add_page(reader.pages[0])
    if rotation: p.rotate(rotation)
p = writer.add_page(reader.pages[0]); p.cropbox.lower_left = (12, 20); p.cropbox.upper_right = (688, 440)
writer.write(folder / 'fixture.pdf')
print('Selection fixture ready')
