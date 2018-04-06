export PATH=${PWD}/bin:$PATH

function clean() {
  echo "#######################################"
  echo "#######    Clean artifacts   ##########"
  echo "#######################################"
  set -x
  rm -rf channel-artifacts/*.block channel-artifacts/*.tx crypto-config
  set +x
  echo
}

function generateCerts() {
  which cryptogen
  if [ "$?" -ne 0 ]; then
    echo "cryptogen tool not found. exiting"
    exit 1
  fi
  echo
  echo "##########################################################"
  echo "##### Generate certificates using cryptogen tool #########"
  echo "##########################################################"

  if [ -d "crypto-config" ]; then
    rm -Rf crypto-config
  fi
  set -x
  cryptogen generate --config=./crypto-config.yaml
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate certificates..."
    exit 1
  fi
  echo
}

function generateChannelArtifacts() {
  which configtxgen
  if [ "$?" -ne 0 ]; then
    echo "configtxgen tool not found. exiting"
    exit 1
  fi
  echo
  echo "##########################################################"
  echo "#########  Generating Orderer Genesis block ##############"
  echo "##########################################################"
  set -x
  configtxgen -profile ThreeOrgsOrdererGenesis -outputBlock ./channel-artifacts/genesis.block
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate orderer genesis block..."
    exit 1
  fi

  echo
  echo "########################################################################"
  echo "### Generating channel configuration transaction 'fredrick-alice.tx' ###"
  echo "########################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx ./channel-artifacts/fredrick-alice.tx -channelID fredrick-alice
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate channel configuration transaction..."
    exit 1
  fi

  echo
  echo "######################################################################"
  echo "### Generating channel configuration transaction 'fredrick-bob.tx' ###"
  echo "######################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx ./channel-artifacts/fredrick-bob.tx -channelID fredrick-bob
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate channel configuration transaction..."
    exit 1
  fi

  echo
  echo "###################################################################"
  echo "### Generating channel configuration transaction 'transfers.tx' ###"
  echo "###################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputCreateChannelTx ./channel-artifacts/transfers.tx -channelID transfers
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate channel configuration transaction..."
    exit 1
  fi

  echo
  echo "#####################################################################"
  echo "#######    Generating anchor peer update for FredrickMSP   ##########"
  echo "#####################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/FredrickMSPanchors.tx -channelID transfers -asOrg FredrickMSP
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate anchor peer update for FredrickMSP..."
    exit 1
  fi

  echo
  echo "##################################################################"
  echo "#######    Generating anchor peer update for AliceMSP   ##########"
  echo "##################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/AliceMSPanchors.tx -channelID transfers -asOrg AliceMSP
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate anchor peer update for AcliceMSP..."
    exit 1
  fi
  echo

  echo
  echo "################################################################"
  echo "#######    Generating anchor peer update for BobMSP   ##########"
  echo "################################################################"
  set -x
  configtxgen -profile ThreeOrgsChannel -outputAnchorPeersUpdate ./channel-artifacts/BobMSPanchors.tx -channelID transfers -asOrg BobMSP
  res=$?
  set +x
  if [ $res -ne 0 ]; then
    echo "Failed to generate anchor peer update for BobMSP..."
    exit 1
  fi
  echo
}

function renameKeys() {
  echo "###################################"
  echo "#######    Rename keys   ##########"
  echo "###################################"
  for file in $(find crypto-config -iname *_sk); do
    dir=$(dirname ${file})
    set -x
    mv ${dir}/*_sk ${dir}/key.pem
    set +x
  done
}

MODE=$1

if [ "${MODE}" == "clean" ]; then
  clean
else
  generateCerts
  generateChannelArtifacts
  renameKeys
fi
