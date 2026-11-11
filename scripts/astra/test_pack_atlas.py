import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from pack_atlas import pack_frames


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'frames'
        self.source.mkdir()
        self.output = self.root / 'export'

    def frame(self, name, mode='RGBA', size=(128, 128)):
        image = Image.new(mode, size)
        image.paste((200, 120, 40, 255) if mode == 'RGBA' else (200, 120, 40), (32, 32, 96, 96))
        image.save(self.source / name)

    def test_round_trip_order_alpha_hash_and_contact(self):
        self.frame('0002.png')
        self.frame('0001.png')
        manifest = pack_frames(self.source, self.output, contact=1)
        self.assertEqual(manifest['frames'], ['0001.png', '0002.png'])
        self.assertEqual(manifest['contactFrame'], 1)
        self.assertEqual(manifest['decodedBytes'], 256 * 128 * 4)
        payload = (self.output / 'atlas.webp').read_bytes()
        self.assertEqual(manifest['sha256'], hashlib.sha256(payload).hexdigest())
        with Image.open(self.output / 'atlas.webp') as image:
            self.assertEqual(image.size, (256, 128))
            self.assertEqual(image.getpixel((0, 0))[3], 0)
            self.assertEqual(image.getpixel((160, 32)), (200, 120, 40, 255))

    def test_rejects_bad_art_without_publishing(self):
        for mode, size in [('RGB', (128, 128)), ('RGBA', (256, 128))]:
            with self.subTest(mode=mode, size=size):
                self.frame('0001.png', mode, size)
                with self.assertRaises(ValueError):
                    pack_frames(self.source, self.output)
                self.assertFalse(self.output.exists())

    def test_rejects_empty_and_opaque_frames(self):
        for color in [(0, 0, 0, 0), (200, 120, 40, 255)]:
            Image.new('RGBA', (128, 128), color).save(self.source / '0001.png')
            with self.assertRaises(ValueError):
                pack_frames(self.source, self.output)

    def test_rejects_missing_frames_invalid_contact_and_overwrite(self):
        with self.assertRaises(ValueError):
            pack_frames(self.source, self.output)
        self.frame('0001.png')
        with self.assertRaises(ValueError):
            pack_frames(self.source, self.output, contact=1)
        pack_frames(self.source, self.output)
        with self.assertRaises(FileExistsError):
            pack_frames(self.source, self.output)

    def test_rejects_overlarge_atlas(self):
        for index in range(9):
            self.frame(f'{index:04}.png', size=(256, 256))
        with self.assertRaises(ValueError):
            pack_frames(self.source, self.output, cell=256, columns=1)


if __name__ == '__main__':
    unittest.main()
