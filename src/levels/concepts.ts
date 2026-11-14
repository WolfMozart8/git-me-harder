import type { L, Level } from './types';

/** A from-zero explanation of one git idea, shown on demand ("What is git stash?"). */
export interface Concept {
  id: string;
  /** Name shown on the chip, e.g. "git stash". */
  title: string;
  /** Which entries of a level's `teaches` list this concept covers. */
  match: RegExp;
  what: L;
  how: L;
  examples: { cmd: string; note: L }[];
}

const t = (es: string, en: string): L => ({ es, en });

export const CONCEPTS: Concept[] = [
  {
    id: 'init',
    title: 'git init',
    match: /git init/,
    what: t(
      'Un **repositorio** es una carpeta cuyo historial de cambios guarda git. `git init` convierte una carpeta normal en un repositorio: crea dentro una carpeta oculta `.git` donde git anota todo.',
      'A **repository** is a folder whose history of changes git keeps. `git init` turns a normal folder into a repository: it creates a hidden `.git` folder inside where git records everything.',
    ),
    how: t('Se ejecuta una sola vez, dentro de la carpeta del proyecto. No borra ni cambia tus archivos.', 'You run it once, inside the project folder. It does not delete or change your files.'),
    examples: [
      { cmd: 'git init', note: t('Crea el repositorio en la carpeta actual.', 'Creates the repository in the current folder.') },
      { cmd: 'ls -a', note: t('Muestra también la carpeta oculta `.git`.', 'Also shows the hidden `.git` folder.') },
    ],
  },
  {
    id: 'status',
    title: 'git status',
    match: /git status/,
    what: t(
      'Te dice en qué estado está todo: en qué rama estás, qué archivos cambiaste, cuáles están listos para el próximo commit y cuáles git aún no conoce. No modifica nada: puedes usarlo cuantas veces quieras.',
      'It tells you the state of everything: which branch you are on, which files you changed, which are ready for the next commit and which git does not know yet. It changes nothing: use it as often as you like.',
    ),
    how: t(
      'Rojo = cambios que todavía no entran en el próximo commit. Verde = cambios ya preparados (staging). Además, entre paréntesis, git sugiere el comando para el siguiente paso.',
      'Red = changes not yet going into the next commit. Green = changes already prepared (staged). Git also suggests, in parentheses, the command for the next step.',
    ),
    examples: [
      { cmd: 'git status', note: t('El resumen completo.', 'The full summary.') },
      { cmd: 'git status -s', note: t('Versión corta: una línea por archivo.', 'Short version: one line per file.') },
    ],
  },
  {
    id: 'add',
    title: 'git add (staging)',
    match: /git add/,
    what: t(
      'Entre tus archivos y el historial hay una zona intermedia: el **staging area**. `git add` copia ahí los cambios que quieres incluir en el próximo commit. Sirve para elegir: puedes haber tocado cinco archivos y guardar solo dos.',
      'Between your files and the history there is a middle zone: the **staging area**. `git add` copies there the changes you want in the next commit. It lets you choose: you may have touched five files and save only two.',
    ),
    how: t(
      'Si modificas un archivo después de añadirlo, tienes que volver a hacer `git add`: en staging queda la versión del momento en que lo añadiste.',
      'If you modify a file after adding it, you must `git add` it again: staging holds the version from the moment you added it.',
    ),
    examples: [
      { cmd: 'git add cart.js', note: t('Prepara un archivo concreto.', 'Stages one specific file.') },
      { cmd: 'git add .', note: t('Prepara todos los cambios de la carpeta.', 'Stages every change in the folder.') },
    ],
  },
  {
    id: 'commit',
    title: 'git commit',
    match: /commit/,
    what: t(
      'Un **commit** es una foto del proyecto en un momento dado, con un mensaje que explica qué cambió. El historial de git es una cadena de commits, y siempre puedes volver a cualquiera de ellos.',
      'A **commit** is a snapshot of the project at a point in time, with a message explaining what changed. Git history is a chain of commits, and you can always go back to any of them.',
    ),
    how: t(
      'Solo entra en el commit lo que está en staging (`git add`). Cada commit recibe un identificador único, el *hash* (por ejemplo `a1b2c3d`).',
      'Only what is staged (`git add`) goes into the commit. Each commit gets a unique identifier, the *hash* (for example `a1b2c3d`).',
    ),
    examples: [
      { cmd: 'git commit -m "fix: total del carrito"', note: t('Crea el commit con ese mensaje.', 'Creates the commit with that message.') },
      { cmd: 'git commit -am "docs: readme"', note: t('Atajo: añade los archivos ya conocidos y hace commit.', 'Shortcut: stages already-tracked files and commits.') },
    ],
  },
  {
    id: 'amend',
    title: 'git commit --amend',
    match: /--amend/,
    what: t(
      'Rehace el **último** commit: sirve para corregir su mensaje o añadirle un cambio que olvidaste. En realidad crea un commit nuevo que reemplaza al anterior.',
      'Redoes the **last** commit: use it to fix its message or add a change you forgot. It actually creates a new commit that replaces the previous one.',
    ),
    how: t(
      'Úsalo solo con commits que no has subido al servidor. Si ya lo tiene alguien más, reemplazarlo les rompe el historial.',
      'Only use it on commits you have not pushed. If someone else already has it, replacing it breaks their history.',
    ),
    examples: [
      { cmd: 'git commit --amend -m "mensaje corregido"', note: t('Cambia el mensaje del último commit.', 'Changes the last commit message.') },
      { cmd: 'git commit --amend --no-edit', note: t('Añade lo que haya en staging al último commit, sin tocar el mensaje.', 'Adds whatever is staged to the last commit, keeping the message.') },
    ],
  },
  {
    id: 'log',
    title: 'git log',
    match: /git log/,
    what: t('Muestra el historial: la lista de commits, del más reciente al más antiguo, con su hash, autor y mensaje.', 'Shows the history: the list of commits, newest first, with hash, author and message.'),
    how: t(
      'Entre paréntesis aparecen las etiquetas que apuntan a cada commit: `HEAD` (dónde estás tú), ramas como `main` y ramas del servidor como `origin/main`.',
      'In parentheses you see the labels pointing at each commit: `HEAD` (where you are), branches like `main` and server branches like `origin/main`.',
    ),
    examples: [
      { cmd: 'git log --oneline', note: t('Una línea por commit. La forma más cómoda.', 'One line per commit. The handiest form.') },
      { cmd: 'git log --oneline --all', note: t('Incluye los commits de todas las ramas.', 'Includes commits from every branch.') },
      { cmd: 'git log -3', note: t('Solo los tres últimos.', 'Only the last three.') },
    ],
  },
  {
    id: 'diff',
    title: 'git diff',
    match: /git diff/,
    what: t('Muestra línea a línea qué cambió. Las líneas con `-` (rojo) son lo que había; las de `+` (verde), lo nuevo.', 'Shows what changed, line by line. Lines with `-` (red) are what was there; lines with `+` (green) are new.'),
    how: t(
      'Sin argumentos compara tus archivos con lo que hay en staging, así que no muestra lo que ya añadiste con `git add`. Para ver eso, usa `--staged`.',
      'With no arguments it compares your files with staging, so it does not show what you already added with `git add`. For that, use `--staged`.',
    ),
    examples: [
      { cmd: 'git diff', note: t('Cambios que aún no están en staging.', 'Changes not staged yet.') },
      { cmd: 'git diff --staged', note: t('Lo que entrará en el próximo commit.', 'What will go into the next commit.') },
      { cmd: 'git diff HEAD~1 HEAD', note: t('Qué cambió en el último commit.', 'What changed in the last commit.') },
    ],
  },
  {
    id: 'restore',
    title: 'git restore',
    match: /git restore/,
    what: t(
      'Deshace cambios que **todavía no están en un commit**. Tiene dos usos: descartar lo que modificaste en un archivo, o sacar un archivo del staging.',
      'Undoes changes that are **not in a commit yet**. Two uses: discard what you modified in a file, or take a file out of staging.',
    ),
    how: t(
      'Cuidado con la primera forma: lo que descartas no se puede recuperar, porque git nunca llegó a guardarlo. La forma `--staged` es segura: no toca el contenido del archivo.',
      'Careful with the first form: what you discard cannot be recovered, because git never saved it. The `--staged` form is safe: it does not touch the file content.',
    ),
    examples: [
      { cmd: 'git restore cart.js', note: t('Deja el archivo como en el último commit.', 'Puts the file back as in the last commit.') },
      { cmd: 'git restore --staged notes.txt', note: t('Lo saca del staging; el archivo queda igual.', 'Unstages it; the file stays the same.') },
    ],
  },
  {
    id: 'gitignore',
    title: '.gitignore',
    match: /gitignore/,
    what: t(
      'Un archivo de texto llamado `.gitignore` con la lista de lo que git debe ignorar: contraseñas, logs, carpetas de dependencias… Lo que coincide con sus patrones no aparece en `git status` ni se añade con `git add .`.',
      'A text file named `.gitignore` listing what git should ignore: passwords, logs, dependency folders… Whatever matches its patterns does not show in `git status` and is not added by `git add .`.',
    ),
    how: t(
      'Un patrón por línea. `*` significa "cualquier cosa". El propio `.gitignore` sí se guarda con commit, para que todo el equipo ignore lo mismo.',
      'One pattern per line. `*` means "anything". The `.gitignore` itself is committed, so the whole team ignores the same things.',
    ),
    examples: [
      { cmd: 'echo ".env" > .gitignore', note: t('Crea el archivo ignorando `.env`.', 'Creates the file, ignoring `.env`.') },
      { cmd: 'echo "*.log" >> .gitignore', note: t('Añade una línea: ignora todos los `.log`.', 'Appends a line: ignore every `.log`.') },
    ],
  },
  {
    id: 'reset',
    title: 'git reset',
    match: /git reset/,
    what: t(
      'Mueve tu rama a otro commit, normalmente hacia atrás, para deshacer commits. Los commits "saltados" dejan de formar parte de la rama.',
      'Moves your branch to another commit, usually backwards, to undo commits. The skipped commits stop being part of the branch.',
    ),
    how: t(
      'La diferencia está en qué pasa con tus archivos. `--soft`: no toca nada, los cambios quedan en staging. Sin opción: los cambios quedan en tus archivos pero fuera de staging. `--hard`: lo borra todo. `HEAD~1` significa "un commit antes del actual". No lo uses con commits ya subidos: para eso está `git revert`.',
      'The difference is what happens to your files. `--soft`: touches nothing, changes stay staged. No option: changes stay in your files but unstaged. `--hard`: wipes everything. `HEAD~1` means "one commit before the current one". Do not use it on pushed commits: that is what `git revert` is for.',
    ),
    examples: [
      { cmd: 'git reset --soft HEAD~1', note: t('Deshace el último commit conservando los cambios.', 'Undoes the last commit, keeping the changes.') },
      { cmd: 'git reset --hard HEAD~1', note: t('Deshace el último commit y descarta sus cambios.', 'Undoes the last commit and discards its changes.') },
      { cmd: 'git reset --hard', note: t('Descarta todo lo que no esté en un commit.', 'Discards everything not in a commit.') },
    ],
  },
  {
    id: 'revert',
    title: 'git revert',
    match: /git revert/,
    what: t(
      'Deshace un commit **creando otro commit** que hace justo lo contrario. El historial no se reescribe: el commit malo sigue ahí, seguido de su "Revert".',
      'Undoes a commit **by creating another commit** that does the exact opposite. History is not rewritten: the bad commit stays, followed by its "Revert".',
    ),
    how: t('Es la forma segura de deshacer algo que el equipo ya tiene, porque nadie tiene que arreglar su copia.', 'It is the safe way to undo something the team already has, because nobody has to repair their copy.'),
    examples: [
      { cmd: 'git revert HEAD', note: t('Revierte el último commit.', 'Reverts the last commit.') },
      { cmd: 'git log --oneline', note: t('Para buscar el hash de un commit más antiguo y revertirlo.', 'To find the hash of an older commit and revert it.') },
    ],
  },
  {
    id: 'branch',
    title: 'Ramas / branches',
    match: /git branch|git switch/,
    what: t(
      'Una **rama** es una línea de trabajo independiente. Te permite desarrollar algo sin tocar `main` (la rama principal) hasta que esté listo. Por dentro es solo una etiqueta que apunta a un commit y avanza con cada commit nuevo.',
      'A **branch** is an independent line of work. It lets you build something without touching `main` (the main branch) until it is ready. Inside, it is just a label pointing at a commit that moves forward with each new commit.',
    ),
    how: t(
      '`HEAD` es la rama en la que estás ahora. Al cambiar de rama, git cambia los archivos de tu carpeta para que coincidan con ella.',
      '`HEAD` is the branch you are on right now. When you switch branches, git changes the files in your folder to match it.',
    ),
    examples: [
      { cmd: 'git switch -c login', note: t('Crea la rama `login` y te cambia a ella.', 'Creates the `login` branch and switches to it.') },
      { cmd: 'git switch main', note: t('Vuelve a `main`.', 'Goes back to `main`.') },
      { cmd: 'git branch', note: t('Lista las ramas; la actual lleva `*`.', 'Lists branches; the current one has `*`.') },
      { cmd: 'git branch -d login', note: t('Borra una rama ya integrada.', 'Deletes an already-merged branch.') },
    ],
  },
  {
    id: 'merge',
    title: 'git merge',
    match: /merge/,
    what: t(
      'Integra en tu rama actual el trabajo de otra rama. Si tu rama no cambió desde que la otra salió, git solo adelanta la etiqueta (*fast-forward*). Si las dos avanzaron, crea un **commit de merge** que une ambas historias.',
      'Brings the work of another branch into your current branch. If your branch did not change since the other one started, git just moves the label forward (*fast-forward*). If both moved on, it creates a **merge commit** joining both histories.',
    ),
    how: t('Colócate primero en la rama que **recibe** los cambios y nombra la rama que quieres traer.', 'First stand on the branch that **receives** the changes, then name the branch you want to bring in.'),
    examples: [
      { cmd: 'git switch main', note: t('Paso 1: ir a la rama que recibe.', 'Step 1: go to the receiving branch.') },
      { cmd: 'git merge login', note: t('Paso 2: traer `login` a `main`.', 'Step 2: bring `login` into `main`.') },
      { cmd: 'git log --oneline --graph', note: t('Ver el resultado.', 'See the result.') },
    ],
  },
  {
    id: 'conflict',
    title: 'Conflictos / conflicts',
    match: /conflict|merge --abort/,
    what: t(
      'Un **conflicto** ocurre cuando dos ramas cambiaron la misma línea de un archivo. Git no puede saber cuál vale, así que se detiene y te deja el archivo marcado: entre `<<<<<<<` y `=======` está tu versión; entre `=======` y `>>>>>>>`, la que llega.',
      'A **conflict** happens when two branches changed the same line of a file. Git cannot know which one is right, so it stops and leaves the file marked: between `<<<<<<<` and `=======` is your version; between `=======` and `>>>>>>>`, the incoming one.',
    ),
    how: t(
      'Para resolverlo: 1) edita el archivo hasta que quede como debe y **borra las tres líneas de marcadores**; 2) `git add <archivo>` para avisar de que está resuelto; 3) `git commit` para terminar. Si te pierdes, `git merge --abort` lo deja todo como antes.',
      'To resolve it: 1) edit the file until it reads as it should and **delete the three marker lines**; 2) `git add <file>` to say it is resolved; 3) `git commit` to finish. If you get lost, `git merge --abort` puts everything back.',
    ),
    examples: [
      { cmd: 'git status', note: t('Muestra qué archivos están en conflicto ("both modified").', 'Shows which files are in conflict ("both modified").') },
      { cmd: 'git add cart.js', note: t('Marca el archivo como resuelto.', 'Marks the file as resolved.') },
      { cmd: 'git commit -m "merge: resolver conflicto"', note: t('Cierra el merge.', 'Concludes the merge.') },
      { cmd: 'git merge --abort', note: t('Cancela el merge y vuelve atrás.', 'Cancels the merge and goes back.') },
    ],
  },
  {
    id: 'stash',
    title: 'git stash',
    match: /git stash/,
    what: t(
      'Guarda temporalmente los cambios que tienes a medias (sin hacer commit) y deja la carpeta limpia. Es como meter tu trabajo en un cajón para atender otra cosa y sacarlo después.',
      'Temporarily shelves your half-done changes (without committing) and leaves the folder clean. Like putting your work in a drawer to deal with something else and taking it out later.',
    ),
    how: t(
      'Lo típico: estás a medias, te piden un arreglo urgente en otra rama. `git stash`, cambias de rama, arreglas, vuelves y `git stash pop`. Los stashes se apilan: el más reciente es `stash@{0}`. `pop` aplica y lo saca de la pila; `apply` aplica pero lo deja guardado.',
      'The classic case: you are mid-work and get asked for an urgent fix on another branch. `git stash`, switch branch, fix, come back and `git stash pop`. Stashes pile up: the newest is `stash@{0}`. `pop` applies and removes it from the pile; `apply` applies but keeps it.',
    ),
    examples: [
      { cmd: 'git stash', note: t('Guarda tus cambios y limpia la carpeta.', 'Shelves your changes and cleans the folder.') },
      { cmd: 'git stash pop', note: t('Recupera el último stash y lo quita de la pila.', 'Restores the latest stash and removes it from the pile.') },
      { cmd: 'git stash list', note: t('Muestra todo lo que tienes guardado.', 'Shows everything you have shelved.') },
      { cmd: 'git stash apply stash@{1}', note: t('Aplica un stash concreto sin borrarlo.', 'Applies a specific stash without deleting it.') },
      { cmd: 'git stash drop', note: t('Elimina el último stash sin aplicarlo.', 'Deletes the latest stash without applying it.') },
    ],
  },
  {
    id: 'remote',
    title: 'Remotos / git clone',
    match: /git clone|git remote/,
    what: t(
      'Un **remoto** es una copia del repositorio que vive en un servidor (GitHub, GitLab…) y que comparte todo el equipo. `git clone` descarga esa copia completa a tu máquina y la deja conectada con el nombre `origin`.',
      'A **remote** is a copy of the repository living on a server (GitHub, GitLab…) that the whole team shares. `git clone` downloads that full copy to your machine and leaves it connected under the name `origin`.',
    ),
    how: t(
      'Tu copia y la del servidor son independientes: nada viaja solo. `origin/main` es lo último que **tú sabes** de la rama `main` del servidor, no necesariamente lo que hay ahora.',
      'Your copy and the server copy are independent: nothing travels by itself. `origin/main` is the last thing **you know** about the server\'s `main` branch, not necessarily what is there now.',
    ),
    examples: [
      { cmd: 'git clone https://git.kiwilabs.dev/kiwi-market.git', note: t('Descarga el repositorio.', 'Downloads the repository.') },
      { cmd: 'git remote -v', note: t('Muestra a qué servidor estás conectado.', 'Shows which server you are connected to.') },
    ],
  },
  {
    id: 'push',
    title: 'git push',
    match: /git push/,
    what: t('Sube tus commits al servidor para que el resto del equipo pueda verlos. Hasta que haces push, tus commits solo existen en tu máquina.', 'Uploads your commits to the server so the rest of the team can see them. Until you push, your commits only exist on your machine.'),
    how: t(
      'Una rama nueva necesita `-u` la primera vez para quedar enlazada con el servidor. Si el servidor tiene commits que tú no tienes, el push es **rechazado**: primero hay que traerlos con `git pull`.',
      'A new branch needs `-u` the first time to get linked to the server. If the server has commits you lack, the push is **rejected**: bring them in first with `git pull`.',
    ),
    examples: [
      { cmd: 'git push', note: t('Sube la rama actual.', 'Uploads the current branch.') },
      { cmd: 'git push -u origin wishlist', note: t('Primera subida de una rama nueva.', 'First upload of a new branch.') },
      { cmd: 'git push origin v1.0', note: t('Sube una etiqueta.', 'Uploads a tag.') },
    ],
  },
  {
    id: 'fetch',
    title: 'git fetch',
    match: /git fetch/,
    what: t(
      'Descarga las novedades del servidor **sin tocar tus archivos ni tus ramas**. Solo actualiza las referencias `origin/...`, para que puedas mirar qué hay de nuevo antes de integrarlo.',
      'Downloads the news from the server **without touching your files or branches**. It only updates the `origin/...` references, so you can look at what is new before integrating it.',
    ),
    how: t('Después de un fetch, `git status` te dice si vas por detrás ("behind") y cuántos commits.', 'After a fetch, `git status` tells you whether you are behind and by how many commits.'),
    examples: [
      { cmd: 'git fetch', note: t('Descarga las novedades.', 'Downloads the news.') },
      { cmd: 'git log --oneline origin/main', note: t('Mira lo que llegó.', 'Look at what arrived.') },
      { cmd: 'git merge origin/main', note: t('Intégralo cuando quieras.', 'Integrate it when you want.') },
    ],
  },
  {
    id: 'pull',
    title: 'git pull',
    match: /git pull/,
    what: t('Trae las novedades del servidor **y** las integra en tu rama. Es un `git fetch` seguido de un `git merge`.', 'Brings the news from the server **and** integrates it into your branch. It is a `git fetch` followed by a `git merge`.'),
    how: t(
      'Si tú y un compañero cambiaron la misma línea, el pull termina en conflicto, igual que un merge. Con `--rebase`, en vez de crear un commit de merge, recoloca tus commits encima de los del servidor.',
      'If you and a teammate changed the same line, the pull ends in a conflict, just like a merge. With `--rebase`, instead of creating a merge commit, it replays your commits on top of the server ones.',
    ),
    examples: [
      { cmd: 'git pull', note: t('Actualiza la rama actual.', 'Updates the current branch.') },
      { cmd: 'git pull --rebase', note: t('Actualiza dejando el historial en línea recta.', 'Updates while keeping history in a straight line.') },
    ],
  },
  {
    id: 'ci',
    title: 'CI / pipeline',
    match: /^CI$/,
    what: t(
      '**CI** (integración continua) es un robot en el servidor que, cada vez que alguien sube código, lo comprueba automáticamente: que arranque y que pasen los tests. Si todo va bien, se despliega a producción.',
      '**CI** (continuous integration) is a robot on the server that automatically checks the code every time someone pushes: that it starts and that tests pass. If all is well, it gets deployed to production.',
    ),
    how: t(
      'En este juego el pipeline tiene tres etapas: **markers** (¿quedaron marcadores de conflicto?), **syntax** (¿el código es válido?) y **tests** (¿calcula lo que debe?). Si falla, el push ya está hecho: se arregla con un commit nuevo y otro push.',
      'In this game the pipeline has three stages: **markers** (any conflict markers left?), **syntax** (is the code valid?) and **tests** (does it compute what it should?). If it fails, the push already happened: you fix it with a new commit and another push.',
    ),
    examples: [
      { cmd: 'git commit -am "fix: corregir resolución"', note: t('Guarda la corrección.', 'Save the fix.') },
      { cmd: 'git push', note: t('Vuelve a lanzar el pipeline.', 'Triggers the pipeline again.') },
    ],
  },
  {
    id: 'rebase',
    title: 'git rebase',
    match: /rebase/,
    what: t(
      'Toma los commits de tu rama y los **vuelve a aplicar** encima de otra rama, como si hubieras empezado tu trabajo hoy. El resultado es un historial en línea recta, sin commits de merge.',
      'Takes the commits of your branch and **re-applies** them on top of another branch, as if you had started your work today. The result is a straight-line history with no merge commits.',
    ),
    how: t(
      'Los commits reaplicados son nuevos (cambia su hash), así que no rebases ramas que otra persona esté usando. Si un commit choca, el rebase se detiene: resuelves, `git add`, y sigues con `git rebase --continue`. Ojo: durante un rebase "el mío" (HEAD) es la rama de destino y "el suyo" es tu commit.',
      'Re-applied commits are new (their hash changes), so do not rebase branches someone else is using. If a commit clashes, the rebase stops: resolve, `git add`, and go on with `git rebase --continue`. Note: during a rebase "ours" (HEAD) is the target branch and "theirs" is your commit.',
    ),
    examples: [
      { cmd: 'git rebase main', note: t('Recoloca tu rama actual encima de `main`.', 'Replays your current branch on top of `main`.') },
      { cmd: 'git rebase --continue', note: t('Sigue después de resolver un conflicto.', 'Continues after resolving a conflict.') },
      { cmd: 'git rebase --abort', note: t('Cancela y vuelve al estado anterior.', 'Cancels and goes back to the previous state.') },
    ],
  },
  {
    id: 'cherry-pick',
    title: 'git cherry-pick',
    match: /cherry-pick/,
    what: t('Copia **un commit concreto** de otra rama a la tuya, sin traer el resto de esa rama.', 'Copies **one specific commit** from another branch onto yours, without bringing the rest of that branch.'),
    how: t(
      'Necesitas identificar el commit: por su hash (lo ves con `git log --oneline <rama>`) o por posición, como `rama~1` ("el penúltimo de esa rama").',
      'You need to identify the commit: by its hash (see it with `git log --oneline <branch>`) or by position, like `branch~1` ("the second-to-last on that branch").',
    ),
    examples: [
      { cmd: 'git log --oneline origin/experiment', note: t('Busca el commit que quieres.', 'Find the commit you want.') },
      { cmd: 'git cherry-pick origin/experiment~1', note: t('Cópialo a tu rama actual.', 'Copy it onto your current branch.') },
    ],
  },
  {
    id: 'tag',
    title: 'git tag',
    match: /tag/,
    what: t('Una **etiqueta** es un nombre fijo para un commit, normalmente una versión (`v1.0`). A diferencia de una rama, nunca se mueve.', 'A **tag** is a fixed name for a commit, usually a version (`v1.0`). Unlike a branch, it never moves.'),
    how: t('Las etiquetas no se suben con un `git push` normal: hay que nombrarlas.', 'Tags are not uploaded by a normal `git push`: you have to name them.'),
    examples: [
      { cmd: 'git tag v1.0', note: t('Etiqueta el commit actual.', 'Tags the current commit.') },
      { cmd: 'git tag', note: t('Lista las etiquetas.', 'Lists tags.') },
      { cmd: 'git push origin v1.0', note: t('Sube la etiqueta al servidor.', 'Uploads the tag to the server.') },
    ],
  },
  {
    id: 'reflog',
    title: 'git reflog',
    match: /reflog/,
    what: t(
      'Es el diario de todos los commits por los que pasó `HEAD`, incluso los que ya no pertenecen a ninguna rama. Es la red de seguridad de git: sirve para recuperar commits "perdidos" tras un reset o un rebase.',
      'It is the diary of every commit `HEAD` has been on, even those no branch points to anymore. It is git\'s safety net: use it to recover commits "lost" after a reset or a rebase.',
    ),
    how: t('Cada línea tiene un hash y una posición como `HEAD@{1}` ("donde estaba HEAD hace un movimiento"). Con cualquiera de los dos puedes volver.', 'Each line has a hash and a position like `HEAD@{1}` ("where HEAD was one move ago"). You can go back with either.'),
    examples: [
      { cmd: 'git reflog', note: t('Muestra el diario.', 'Shows the diary.') },
      { cmd: 'git reset --hard HEAD@{1}', note: t('Vuelve a donde estabas antes del último movimiento.', 'Goes back to where you were before the last move.') },
    ],
  },
];

export const conceptById = (id: string) => CONCEPTS.find((c) => c.id === id);

/** The concepts a level touches, derived from the commands it teaches. */
export function conceptsFor(level: Level): Concept[] {
  return CONCEPTS.filter((c) => level.teaches.some((cmd) => c.match.test(cmd)));
}
