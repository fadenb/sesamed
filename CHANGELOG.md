#### 0.1.1 (2019-03-03)

##### Chores

*  use minified version of ether for browserify ([e7fd611c](https://github.com/redmedical/sesamed/commit/e7fd611c828e85ccfda141303c029db8d4f59b8a))
*  set solc version fix to 0.5.0 ([f637f2e8](https://github.com/redmedical/sesamed/commit/f637f2e812dc31d1854f5917a5bd08228e7608b0))
*  reorder scripts alphabetically / new scripts ([06082079](https://github.com/redmedical/sesamed/commit/0608207921ca342ca556e71c05fcfaa0a198fbb9))
*  update npm packages ([709da5f0](https://github.com/redmedical/sesamed/commit/709da5f031383398f4a1ac778c2be72e33892c17))

##### Bug Fixes

*  moved go-ipfs to devDependecies ([aeca822b](https://github.com/redmedical/sesamed/commit/aeca822bb0f6b592d9915e78f6259d54b60e8a88))

### 0.1.0 (2019-03-03)

##### New Features

*  overall work on the whole project ([2cc47018](https://github.com/redmedical/sesamed/commit/2cc470180b0df2e184402310ec1d5767d9e9e83d))

#### 0.0.5 (2019-02-24)

##### Chores

* **scripts:**  added the changelog release scripts ([a75b0fda](https://github.com/redmedical/sesamed/commit/a75b0fda452740c307fb78933db6eaaa362d3444))
* **browserify:**  removed all parts to browserify test ([b690eb65](https://github.com/redmedical/sesamed/commit/b690eb65ca45b2ec2eff4fcdcc6639d6738a52a1))
* **eslint:**  change the indent for switch/case ([eacb2996](https://github.com/redmedical/sesamed/commit/eacb299698b01d488de9c883a5c32c69c865b6c8))
* **dependencies:**
  *  add generate-changelog to devDeoendecies ([aab8e10a](https://github.com/redmedical/sesamed/commit/aab8e10a745efaa03d2df27137e5b66928bbbdb6))
  *  add node_modules to .gitignore ([369115a9](https://github.com/redmedical/sesamed/commit/369115a97ef72cb9c566d7ca16618af79ad5fafb))
  *  removed unused package butternut ([07ceb2a6](https://github.com/redmedical/sesamed/commit/07ceb2a6c237ce6128f798f20e304a4ce771c47a))
* **version:**  release 0.0.4 ([fa0ac0df](https://github.com/redmedical/sesamed/commit/fa0ac0dfd658408419da1b0fb1549c721f97d604))
* **sesamed:**  version 0.0.3 ([854b969e](https://github.com/redmedical/sesamed/commit/854b969e9e29eb96e543083fe38b267bdc4c2c90))

##### Documentation Changes

* **README:**  updated the contribution hints ([8a69cf1f](https://github.com/redmedical/sesamed/commit/8a69cf1f1adb1b2248cf9667df0a02686627772d))
* **aftercare:**  implement afterCare of README.md ([10250593](https://github.com/redmedical/sesamed/commit/10250593e42fb21d3bb78cbd2952fd2bef02bb26))
* **changlog:**  introduce CHANGELOG.MD ([f9b6eda0](https://github.com/redmedical/sesamed/commit/f9b6eda007e184a1660f7be44f7385cc9f605159))
* **all:**  @fulfil --> @resolve ([387dc7f3](https://github.com/redmedical/sesamed/commit/387dc7f348f8cc28df8ccd1babea903660407635))

##### New Features

* **sesamed:**  implement channels and documents ([d5582717](https://github.com/redmedical/sesamed/commit/d5582717674e23298cbe5d24e9d406b495623c00))
* **ipfs:**
  *  implement ipfs.setGateway and default ([8c06aaee](https://github.com/redmedical/sesamed/commit/8c06aaee5383a4994714bc86b65127ac0b41003c))
  *  implement ipfs functions ([5289f9db](https://github.com/redmedical/sesamed/commit/5289f9db87b3158c3e3ac9581b04b02a3a79484a))
* **account:**  implement all account methods ([02d588ce](https://github.com/redmedical/sesamed/commit/02d588cef12ae24e511180e85a0536dcef1e98fe))

##### Bug Fixes

* **tests:**  fixed problems in tests with provider.getBlockNumber ([3ea26539](https://github.com/redmedical/sesamed/commit/3ea26539480ad5c8f59c34652bd0a23a20dea8f9))
* **browserify:**  let tests run in browser again ([08093f13](https://github.com/redmedical/sesamed/commit/08093f13884ffb9530f2860438771587636cc3d6))
* **docs:**  updated branch from develop to master ([038b0d72](https://github.com/redmedical/sesamed/commit/038b0d72a11d62eb5de7de9fb46ad2c2162dd2c6))

##### Other Changes

* **sesamed:**  Version 0.0.1 ([4dac834c](https://github.com/redmedical/sesamed/commit/4dac834c35fec22710adfad9f52d5b0688eb30eb))

##### Refactors

* **api:**  rename createAccount() to getNewAccount() ([375d24d7](https://github.com/redmedical/sesamed/commit/375d24d73a192ee469e038573ae75b9f1dc88b12))
* **ethers:**  rename test property to _ethers ([45ac5576](https://github.com/redmedical/sesamed/commit/45ac55767def38b6c14ed63f5c06db03e1b48380))

##### Tests

* **contracts:**  extend channelContract tests ([4969089b](https://github.com/redmedical/sesamed/commit/4969089b10522742fae7266806323439055bbf73))
* **aes:**  removed unnecessary test on browser ([dd05a810](https://github.com/redmedical/sesamed/commit/dd05a810dce20b9bfd88040b1aa6556190efc186))

#### 0.0.4 (2019-02-23)

##### Chores

* **version:**  release 0.0.4 ([fa0ac0df](https://github.com/redmedical/sesamed/commit/fa0ac0dfd658408419da1b0fb1549c721f97d604))
* **dependencies:**
  *  add node_modules to .gitignore ([369115a9](https://github.com/redmedical/sesamed/commit/369115a97ef72cb9c566d7ca16618af79ad5fafb))
  *  removed unused package butternut ([07ceb2a6](https://github.com/redmedical/sesamed/commit/07ceb2a6c237ce6128f798f20e304a4ce771c47a))
* **sesamed:**  version 0.0.3 ([854b969e](https://github.com/redmedical/sesamed/commit/854b969e9e29eb96e543083fe38b267bdc4c2c90))

##### Documentation Changes

* **all:**  @fulfil --> @resolve ([387dc7f3](https://github.com/redmedical/sesamed/commit/387dc7f348f8cc28df8ccd1babea903660407635))

##### New Features

* **ipfs:**
  *  implement ipfs.setGateway and default ([8c06aaee](https://github.com/redmedical/sesamed/commit/8c06aaee5383a4994714bc86b65127ac0b41003c))
  *  implement ipfs functions ([5289f9db](https://github.com/redmedical/sesamed/commit/5289f9db87b3158c3e3ac9581b04b02a3a79484a))
* **account:**  implement all account methods ([02d588ce](https://github.com/redmedical/sesamed/commit/02d588cef12ae24e511180e85a0536dcef1e98fe))

##### Bug Fixes

* **docs:**  updated branch from develop to master ([038b0d72](https://github.com/redmedical/sesamed/commit/038b0d72a11d62eb5de7de9fb46ad2c2162dd2c6))

##### Other Changes

* **sesamed:**  Version 0.0.1 ([4dac834c](https://github.com/redmedical/sesamed/commit/4dac834c35fec22710adfad9f52d5b0688eb30eb))

##### Refactors

* **api:**  rename createAccount() to getNewAccount() ([375d24d7](https://github.com/redmedical/sesamed/commit/375d24d73a192ee469e038573ae75b9f1dc88b12))
* **ethers:**  rename test property to _ethers ([45ac5576](https://github.com/redmedical/sesamed/commit/45ac55767def38b6c14ed63f5c06db03e1b48380))

##### Tests

* **aes:**  removed unnecessary test on browser ([dd05a810](https://github.com/redmedical/sesamed/commit/dd05a810dce20b9bfd88040b1aa6556190efc186))

