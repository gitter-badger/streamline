import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import FSReactToastr from './FSReactToastr';
import CommonNotification from '../utils/CommonNotification';
import {toastOpt} from '../utils/Constants';
import ClusterREST from '../rest/ClusterREST';
import EnvironmentREST from '../rest/EnvironmentREST';


const ItemsMapping = (props) => {
    const {item,itemClicked} = props;
    let name = item.name.replace('_',' ');
    return(
      <li>
        <img onClick={itemClicked}
          data-id={`${item.clusterId}@${item.name}`}
          className=''
          src={`styles/img/icon-${item.name.toLowerCase()}.png`}/>
          {name}
      </li>
    )
}

class AddEnvironmentItems extends Component{
  constructor(props){
    super(props)
  }
  onItemClicked = (e) => {
    const {mapSelection} = this.props;
    const targetEl = e.target;
    const params = targetEl.attributes["data-id"].value.split('@');
    const classStr = targetEl.attributes["class"].value.trim();


    (classStr.length === 0) ? targetEl.setAttribute("class","activeImg") : targetEl.setAttribute("class","")

    const obj = {
      clusterId : Number(params[0]),
      serviceName : params[1].toString()
    }
    mapSelection(obj);
  }
  render(){
    const {clusterList} = this.props;
    const {cluster,services} = clusterList;
    const tempArr = services || [{
        service: (services === undefined)
            ? ''
            : services.service
    }];
    let serviceWrap = [];
    let t = [];
    tempArr.map((s)=>{
      if(s.service.name.length > 8){
        t.push(s);
      } else {
        serviceWrap.push(s);
      }
    })
    Array.prototype.push.apply(serviceWrap, t);
    return(
      <div className="col-md-4">
      <div className="environment-modal-widget">
          <h5 className="environment-title no-margin-top">{cluster.name}</h5>
          <ul className="select-env-service clearfix">
            {
              serviceWrap.length === 0
              ? <div className="col-sm-12 text-center">
                  No Service
                </div>
            : serviceWrap.map((item , i) => {
                  return <ItemsMapping key={item.service.id}
                          item={item.service}
                          itemClicked={this.onItemClicked} />
                })
            }
          </ul>
      </div>
    </div>
    )
  }
}

class AddEnvironment extends Component{
  constructor(props){
    super(props)
    this.state = {
      entities : [],
      fetchLoader : true,
    };
    this.selectionList = {};
    this.fetchData();
  }

  fetchData = () => {
    let promiseArr = [ClusterREST.getAllCluster()];
    if(this.props.namespaceId){
      promiseArr.push(EnvironmentREST.getNameSpace(this.props.namespaceId))
    }

    Promise.all(promiseArr)
      .then(results=>{
        results.map((result, i)=>{
          if(result.responseMessage !== undefined) {
            this.setState({fetchLoader : false});
            FSReactToastr.error(<CommonNotification flag="error" content={result.responseMessage}/>, '', toastOpt)
          } else {
            if(i === 0){
              result.entities.map(x => {
                if(this.selectionList[x.cluster.id] === undefined){
                  this.selectionList[x.cluster.id] = [];
                }
              });
              this.setState({fetchLoader : false, entities: result.entities});
            } else if(i === 1){
              this.nameRef.value = result.namespace.name;
              this.descRef.value = result.namespace.description;
              result.mappings.map((o)=>{
                document.querySelector('[data-id="'+o.clusterId+'@'+o.serviceName+'"]').className="activeImg";
                this.mapSelectionHandler(o);
              })
            }
          }
        })
      })
      .catch((err) => {
        this.setState({fetchLoader : false});
        FSReactToastr.error(<CommonNotification flag="error" content={err.message}/>, '', toastOpt)
      });
  }

  validation = () => {
    const formNodes = this.refs.addEvtModelRef.children;
    let errArr = [];
    if(this.nameRef.value.trim() == ''){
      errArr.push("error");
      this.nameRef.setAttribute('class', "form-control invalidInput");
    } else {
      this.nameRef.setAttribute('class', "form-control");
    }

    if(this.descRef.value.trim() == ''){
      errArr.push("error");
      this.descRef.setAttribute('class', "form-control invalidInput");
    } else {
      this.descRef.setAttribute('class', "form-control");
    }

    let missingStorm = true;
    _.keys(this.selectionList).map(key =>{
      this.selectionList[key].map((o)=>{
        if(o.serviceName.toLowerCase() === 'storm'){
          missingStorm = false;
        }
      })
    });
    if(missingStorm){
      this.refs.missingStorm.className = 'text-danger';
      errArr.push("error");
    } else {
      this.refs.missingStorm.className = '';
    }
    return (errArr.length === 0) ? true : false;
  }

  handleSave = () => {
    if(this.validation()){
      const evt_name = this.nameRef.value.trim();
      const desc = this.descRef.value.trim();

      // remove the pushId from the selectionList
      let tempData =_.keys(this.selectionList).map(key =>{
            return this.selectionList[key].map(x => {
              // delete x['serviceId'];
              return x;
            });
      });
      const obj = {
        name : evt_name,
        description : desc,
        streamingEngine: 'STORM'
      };
      tempData = _.flatten(tempData);
      if(tempData.find((o)=>{return o.serviceName.toLowerCase() == 'ambari_metrics'})){
        obj['timeSeriesDB'] = 'AMBARI_METRICS';
      }
      return {obj,tempData};
    }
  }

  mapSelectionHandler = (dataObj) => {
    const index = this.selectionList[dataObj.clusterId].findIndex((x)=>{
      return x.serviceName == dataObj.serviceName
    });

    if(index !== -1){
      this.selectionList[dataObj.clusterId].splice(index,1);
    }else{
      if(dataObj.serviceName.toLowerCase() === "storm"){
        let t_clusterId, t_index;
        _.keys(this.selectionList).map(key => {
            this.selectionList[key].map((x , i) => {
              if(x.serviceName.toLowerCase() === "storm"){
                t_clusterId = key;
                t_index = i;
              }
            })
        });
        if(t_clusterId !== undefined){
          document.querySelector('[data-id="'+t_clusterId+'@'+dataObj.serviceName+'"]').className="";
          this.selectionList[t_clusterId].splice(t_index,1);
        }
      }
      this.selectionList[dataObj.clusterId].push(dataObj);
    }
  }
  componentWillUnmount(){
    this.selectionList = [];
  }
  render(){
    const {fetchLoader,entities} = this.state;
    return(
      <div className="modal-form config-modal-form" ref="addEvtModelRef">
        <div className="form-group">
          <label>Name <span className="text-danger">*</span></label>
            <input
              type="text"
              ref={(ref) => this.nameRef = ref}
              name="environmentName"
              placeholder="Environment Name"
              required="true"
              className="form-control"
            />
        </div>
        <div className="form-group">
          <label>Description <span className="text-danger">*</span></label>
            <input
              type="text"
              ref={(ref) => this.descRef = ref}
              name="description"
              placeholder="Description"
              required="true"
              className="form-control"
            />
        </div>
        <h4 className="environment-modal-title">Select Services</h4>
        {
          entities.length !== 0
          ? <small ref="missingStorm"> (Atleast one streaming engine (eg: STORM) must be selected.)</small>
          : ''
        }
        <div className="row">
          {
            fetchLoader
            ? <div className="col-sm-12">
                <div className="loading-img text-center">
                      <img src="styles/img/start-loader.gif" alt="loading" />
                </div>
              </div>
            : <div>
                {
                  entities.length === 0
                  ? <div className="col-sm-12 text-center">
                      No Clusters
                    </div>
                : entities.map( list => {
                    return <AddEnvironmentItems
                            key={list.cluster.id}
                            clusterList={list}
                            mapSelection={this.mapSelectionHandler}
                            />
                  })
                }
              </div>
          }

        </div>
      </div>
    )
  }
}

export default AddEnvironment;