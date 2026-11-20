import os
import re
import shutil
import subprocess

class Migrate:
    def replace_media(self, file):
        file_str = ""
        with open(file, 'r', encoding='utf-8') as f:
            file_str = f.read()
        file_str = file_str.replace('/assets/', '/media/dist/assets/')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(file_str)
        return file_str

    def main(self, *args, **options):
        pwd = os.getcwd()
        media_dir = "back/media/dist"
        react_build = "front/dist"
        # os.chdir(pwd)

        # Borra build anterior si hay
        try:
            shutil.rmtree(media_dir, ignore_errors=True)
        except Exception as e:
            pass

        # Crea el directorio si no existe
        try:
            os.makedirs(media_dir, exist_ok=True)
        except Exception as e:
            pass

        # Copia los archivos del build
        try:
            shutil.copytree(react_build, media_dir, dirs_exist_ok=True)
        except Exception as e:
            pass

        # Replace /assets/ -> /media/dist/assets/
        html = self.replace_media(f"{media_dir}/index.html")

        # get js name
        files = os.listdir(f'{media_dir}/assets')
        # print(files)
        file_name = ''
        js_files = []
        for file in files:
            if file.endswith('.js'):
                js_files.append(file)

        for file_name in js_files:
            print(file_name)
            js = self.replace_media(f"{media_dir}/assets/{file_name}")

            structure = r'''https?://localhost(:\d+)?'''
            matches = re.finditer(structure, js)
            matches = sorted(matches, key=lambda x: len(x.group(0)), reverse=True)
            for match in matches:
                print(match.group(0))
                js = js.replace(match.group(0), '')
            with open(f'{media_dir}/assets/{file_name}', 'w', encoding='utf-8') as f:
                f.write(js)

        # --------------------------------   css   -----------------
        file_name = ''
        css_files = []
        for file in files:
            if file.endswith('.css'):
                css_files.append(file)

        for file_name in css_files:
            print(file_name)
            css = self.replace_media(f"{media_dir}/assets/{file_name}")

        # --------------------------------   mundo compartido   -----------------
        # El servidor de la sim (Node) va en un solo archivo, back/mundo/servidor.bundle.mjs, generado desde
        # back/mundo/servidor.mjs + la sim del front. Se comitea junto con back/media/dist.
        try:
            subprocess.run(['node', os.path.join('back', 'mundo', 'empaquetar.mjs')], check=True)
        except Exception as e:
            print(f'AVISO: no se generó back/mundo/servidor.bundle.mjs ({e}); corre "cd front && pnpm build:mundo"')

        print('Done')


if __name__ == '__main__':
    Migrate().main()