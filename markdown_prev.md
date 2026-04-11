
# Installation et configuration Veeam backup agent Linux 13
<br/>

## Prérequis

- VM enregistrée dans le satellite
- Dépôt **veeam-agent** (id repo SAOL_VEEAM_veeam-agent) activé pour l'hôte
- Disposer d'un accès root à la VM
<br/>

### Installation de l'agent
Se connecter à la VM par SSH (utiliser le compte sysadmin disposant des droits sudo nécéssaires).
<br/>

`[sysadmin@pphlond2scm01 ~]$`

> [!caution]
> On passe en root

```bash
sudo su -
```

### Vérifier la disponibilité du dépôt veeam-agent
<br/>

`[root@pphlond2scm01 ~]#`
```bash
dnf repolist 
```

<br/>
<div class="md-container md-container-shellout">
<pre>Mise à jour des référentiels de gestion des abonnements.
id du dépôt                              nom du dépôt
SAOL_EPEL_9-x86_64                       9-x86_64
SAOL_VEEAM_veeam-agent                   veeam-agent
rhel-9-for-x86_64-appstream-rpms         Red Hat Enterprise Linux 9 for x86_64 - AppStream (RPMs)
rhel-9-for-x86_64-baseos-rpms            Red Hat Enterprise Linux 9 for x86_64 - BaseOS (RPMs)</pre>
</div>

<br/>

### Installer les packages

```bash
dnf install kmod-blksnap veeam
```

<div class="md-container md-container-shellout">
<pre>Installé:
  kmod-blksnap-13.0.1.203-1.el9.x86_64           veeam-13.0.1.203-1.el9.x86_64
  
Terminé !</pre>
</div>

<br>

### Configurer UEFI secure boot
<br/>

Enrollement MOK (Machine Owner Key) Installer la clé du module **blksnap** pre builder

```bash
dnf install veeam-ueficert
```

<div class="md-container md-container-shellout">
<pre>Installé:
  veeam-ueficert-13.0.1.203-1.noarch

Terminé !</pre>
</div>
<br/>

Avant de redémarrer, ouvrir une console sur la VM pour entrer dans l'enrollement MOK
Puis redémarrer:

```bash
reboot
```
<br/>

Au démarrage de la VM interrompre le démarrage en appuyant sur <kbd>↓ down</kbd> \
lorsque le menu pour l'import de la clé MOK s'affiche.

<br/>

Selectionner Enroll MOK puis <kbd>⏎ Enter</kbd> \
![mok1.png](/images/backup/veeam/mok1.png)

Continue <kbd>⏎ Enter</kbd> \
![mok2.png](/images/backup/veeam/mok2.png)

Selectionner yes puis <kbd>⏎ Enter</kbd> \
![mok3.png](/images/backup/veeam/mok3.png)

Tapper le mot de passe **root** de la VM puis <kbd>⏎ Enter</kbd> \
![mok4.png](/images/backup/veeam/mok4.png)

Enfin rebooter en appuyant sur <kbd>⏎ Enter</kbd> \
![mok5.png](/images/backup/veeam/mok5.png)
<br>

## Installation et configuration SSHFS

L'agent Veeam backup pour linux en version gratuite permet uniquement de sauvegarder \
sur un point de montage local. On va installer et configurer sshfs pour monter le répertoire de \
sauvegarde où sont stocké tous les backups Veeam des VMs.
<br/>
### Installer **fuse-sshfs** (le dépot EPEL9 doit être displonible)
```bash
dnf install sshfs
```

<div class="md-container md-container-shellout">
<pre>Installé:
  fuse-sshfs-3.7.3-1.el9.x86_64

Terminé !</pre>
</div>

<br>
<br>

### Création de la clé ssh pour le montage sshfs
<br/>

Nous changer d'utilisateur pour la génération de la clé SSH ed25519.
L'utilisateur **backup** est un utilisateur présent sur l'IDM Red Hat pas besoin \
de le créer localement. Son home directory sera crée automatique à sa première connexion.

```bash
su - backup
```

puis

```bash
ssh-keygen -t ed25519 -C "PPHLOND2IPAM01"
```

> [!warning]
> Ne pas mettre de passphrase
On laisse le chemin de la clé par défaut


<div class="md-container md-container-shellout">
<pre>
Generating public/private ed25519 key pair.
Enter file in which to save the key (/home/backup/.ssh/id_ed25519):</pre>
</div>

<br/>
On copie la clé public associé à notre clé privé fraichement générée.
Entré le mot de passe du user **backup**.

```bash
ssh-copy-id -i /home/backup/.ssh/id_ed25519.pub pphlond2backup01.ol.internal
```

<div class="md-container md-container-shellout">
<pre>/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "/home/backup/.ssh/id_ed25519.pub"
/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed
/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys
(backup@pphlond2backup01.ol.internal) Password:

Number of key(s) added: 1

Now try logging into the machine, with:   "ssh 'pphlond2backup01.ol.internal'"
and check to make sure that only the key(s) you wanted were added.</pre>
</div>


> [!caution]
> On repasse en root pour la suite des opérations

`[backup@pphlond2ipam01 ~]$`
```bash 
exit
```

`[root@pphlond2ipam01 ~]#`

<br><br>

### Créer le répertoire où sera monté le backups
```bash
mkdir -p /backups/veeam_backups
```

### Ajout de la unit systemd pour automatiser le montage du repository de backups
<br/>

On va utiliser un service systemd pour le montage automatique.
Créer la unit comme cela:
```bash
vi /etc/systemd/system/veeam-sshfs-mount.service
```

```bash
Description=SSHFS Mount for Veeam Backups
After=network-online.target multi-user.target systemd-user-sessions.service
Wants=network-online.target
DefaultDependencies=no

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/bin/sleep 10
ExecStart=/usr/bin/sshfs backup@pphlond2backup01.ol.internal:/backups/veeam_backups \
  /backups/veeam_backups \
  -o allow_other \
  -o IdentityFile=/home/backup/.ssh/id_ed25519 \
  -o reconnect \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o uid=1378600030 \
  -o gid=1378600030 \
  -o StrictHostKeyChecking=no
ExecStop=/usr/bin/umount /backups/veeam_backups

[Install]
WantedBy=multi-user.target
```

On prend en compte les modification systemd
```bash
systemctl daemon-reload
systemctl enable --now veeam-sshfs-mount.service
```

on vérifie que ça monte
```bash
ll /backups/veeam_backups/
```

<div class="md-container md-container-shellout">
<pre>
total 40
-rwxr-xr-x. 1 backup backup   47 20 mars  13:25  idm_postjob.sh
-rwxr-xr-x. 1 backup backup   46 20 mars  08:33  idm_prejob.sh
drwxrws---. 1 backup backup 4096  3 avril 21:47 'pphlond2idm01.ol.internal PPHLOND2IDM01'
drwxrws---. 1 backup backup 4096  3 avril 22:01 'pphlond2repo01.ol.internal PPHLOND2REPO01'
drwxrws---. 1 backup backup 4096  4 avril 10:09 'pphlond2scm01.ol.internal PPHLOND2SCM01'
-rwxr-xr-x. 1 backup backup  116  3 avril 18:51  PPHLOND2SCM01_start_prejob.sh
-rwxr-xr-x. 1 backup backup 7775  3 avril 18:52  PPHLOND2SCM01_stop_prejob.sh
-rwxr-xr-x. 1 backup backup   66 20 mars  13:25  satellite_postjob.sh
-rwxr-xr-x. 1 backup backup   65 19 mars  09:51  satellite_prejob.sh</pre>
</div>

> [!note]
> Si ce n'est pas vide alors on est OK

<br/>

## Configuration du job de sauvegarde
<br/>

Certains paramètres de configuration sont disponibles seulement avec le cli **veeamconfig**
Nous commençons par creer le repository de sauvegarde.

```bash
veeamconfig repository create --name veeam-backups --location /backups/veeam_backups --type local`
```

Pour identifier les volumes à sauvegarder on utilise **lsblk**
```bash
lsblk
```

<div class="md-container md-container-shellout">
<pre>NAME                       MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sda                          8:0    0   30G  0 disk
└─sda1                       8:1    0   30G  0 part
  └─VG--DATA-home          253:3    0   29G  0 lvm  /home
sdb                          8:16   0  100G  0 disk
├─sdb1                       8:17   0  600M  0 part /boot/efi
├─sdb2                       8:18   0    1G  0 part /boot
└─sdb3                       8:19   0 98,4G  0 part
  ├─VG--ROOT-root          253:0    0   20G  0 lvm  /
  ├─VG--ROOT-swap          253:1    0    8G  0 lvm  [SWAP]
  ├─VG--ROOT-usr           253:2    0   15G  0 lvm  /usr
  ├─VG--ROOT-tmp           253:4    0    5G  0 lvm  /tmp
  ├─VG--ROOT-var_lib       253:5    0   10G  0 lvm  /var/lib
  ├─VG--ROOT-var_log_audit 253:6    0    2G  0 lvm  /var/log/audit
  ├─VG--ROOT-var_log       253:7    0    8G  0 lvm  /var/log
  └─VG--ROOT-var           253:8    0   15G  0 lvm  /var
sr0                       11:0    1  764M  0 rom</pre>
</div>

> [!note]
> Dans la sortie précédente on identifie clairement que 2 montages ne font pas partie d'un VG
**/boot/efi** et **/boot**. On les copie dans un bloc note.

<br/>

On va lister les VG

```bash
vgs
```

<div class="md-container md-container-shellout">
<pre> VG      #PV #LV #SN Attr   VSize   VFree
  VG-DATA   1   1   0 wz--n- <30,00g 1020,00m
  VG-ROOT   1   8   0 wz--n-  98,41g   15,41g</pre>
</div>



> [!note]
> On copie les VG dans un bloc note.

<br/>
On crée la liste des volumes avec les informations récupérées:

```bash
BCK_VOL="/boot,/boot/efi,VG-ROOT,VG-DATA"
```

On crée le job de sauvegarde

```bash
veeamconfig job create volumeLevel --name PPHLOND2SCM01 --repoName veeam-backups --prejob "/backups/veeam_backups/PPHLOND2SCM01_stop_prejob.sh" --postjob "/backups/veeam_backups/PPHLOND2SCM01_start_prejob.sh" --objects $BCK_VOL --setEncryption --compressionLevel 2`
```














