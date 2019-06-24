#/bin/bash
sudo docker rm $(sudo docker ps -a -q)
sudo docker rmi $(sudo docker images -q)
sudo docker volume ls | sudo awk '$1 == "local" { print $2 }' | sudo xargs --no-run-if-empty docker volume rm
