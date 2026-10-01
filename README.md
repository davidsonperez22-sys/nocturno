# NOCTURNO

Plataforma de películas creada con HTML5, CSS3, JavaScript puro y Firebase Authentication + Firestore. Está preparada para GitHub Pages.

## Archivos

index.html, movie.html, login.html, admin.html, css/style.css, js/firebase-config.js, js/auth.js, js/movies.js, js/admin.js y firestore.rules.

## Configuración Firebase

1. Crea un proyecto en Firebase Console.
2. Activa Authentication con correo/contraseña y Google.
3. Crea Firestore Database.
4. Pega el contenido de firestore.rules en Firestore > Rules y publica.
5. Registra una aplicación web en Project settings > Your apps.
6. Copia firebaseConfig en js/firebase-config.js reemplazando los valores REEMPLAZA_CON...
7. En Authentication > Settings > Authorized domains agrega TU_USUARIO.github.io y localhost.

La configuración web de Firebase puede estar en el frontend. No publiques claves privadas ni archivos Service Account JSON.

## Convertir el primer usuario en admin

Regístrate en login.html. Luego busca tu UID en Authentication > Users, abre el documento con el mismo ID en users y cambia rol de user a admin. Verifica que bloqueado sea false como booleano. Cierra sesión y vuelve a entrar.

## Reglas de Firestore

movies y settings requieren sesión para lectura. Solo admin puede escribir películas y configuración. Cada usuario puede actualizar su propio documento y favoritos, pero no puede modificar UID, rol o bloqueado. Un admin puede gestionar otros usuarios y no puede cambiar su propio rol desde el panel.

## GitHub Pages

Repositorio: https://github.com/davidsonperez22-sys/nocturno

En Settings > Pages selecciona Deploy from a branch, branch main y carpeta root. La dirección será https://davidsonperez22-sys.github.io/nocturno/.

Para cambios posteriores:

git add .
git commit -m "Actualizar NOCTURNO"
git push

Usa URLs HTTPS de imágenes, tráileres y videos que tengas autorización para publicar.
