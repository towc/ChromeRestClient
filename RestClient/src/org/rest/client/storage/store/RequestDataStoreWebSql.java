package org.rest.client.storage.store;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.rest.client.storage.StoreResultCallback;
import org.rest.client.storage.WebSqlAdapter;
import org.rest.client.storage.store.objects.RequestObject;
import org.rest.client.storage.websql.RequestDataService;

import com.google.code.gwt.database.client.service.DataServiceException;
import com.google.code.gwt.database.client.service.ListCallback;
import com.google.code.gwt.database.client.service.RowIdListCallback;
import com.google.code.gwt.database.client.service.VoidCallback;
import com.google.gwt.core.client.GWT;

public class RequestDataStoreWebSql extends WebSqlAdapter<Integer, RequestObject> {
	
	RequestDataService service = GWT.create(RequestDataService.class);
	
	
	public RequestDataService getService(){
		return service;
	}
	
	@Override
	public void open(final StoreResultCallback<Boolean> callback) {
		service.initTable(new VoidCallback() {
			
			@Override
			public void onFailure(DataServiceException error) {
				callback.onError(error);
			}
			
			@Override
			public void onSuccess() {
				callback.onSuccess(true);
			}
		});
	}

	@Override
	public void keys(StoreResultCallback<List<Integer>> callback) {
		callback.onError(null);
	}

	@Override
	public void put(RequestObject obj, Integer key,
			final StoreResultCallback<Integer> callback) {
		service.insertData(obj, new Date(), new RowIdListCallback() {
			
			@Override
			public void onFailure(DataServiceException error) {
				callback.onError(error);
			}
			
			@Override
			public void onSuccess(List<Integer> rowIds) {
				if(rowIds.size() == 0){
					callback.onError(null);
					return;
				}
				callback.onSuccess(rowIds.get(0));
			}
		});
	}

	@Override
	public void getByKey(Integer key,
			final StoreResultCallback<RequestObject> callback) {
		service.getRequest(key, new ListCallback<RequestObject>() {

			@Override
			public void onFailure(DataServiceException error) {
				callback.onError(error);
			}

			@Override
			public void onSuccess(List<RequestObject> result) {
				if(result.size() == 0){
					callback.onSuccess(null);
					return;
				}
				callback.onSuccess(result.get(0));
			}
		});
	}

	@Override
	public void exists(Integer key, StoreResultCallback<Boolean> callback) {
		callback.onError(null);
	}

	@Override
	public void all(final StoreResultCallback<Map<Integer, RequestObject>> callback) {
		
		service.getAllData(new ListCallback<RequestObject>() {
			@Override
			public void onFailure(DataServiceException error) {
				callback.onError(error);
			}
			
			@Override
			public void onSuccess(List<RequestObject> result) {
				Map<Integer, RequestObject> mapResult = new HashMap<Integer, RequestObject>();
				for(RequestObject item : result){
					mapResult.put(item.getId(), item);
				}
				callback.onSuccess(mapResult);
			}
		});
	}

	@Override
	public void remove(Integer key, StoreResultCallback<Boolean> callback) {
		callback.onError(null);
	}

	@Override
	public void countAll(StoreResultCallback<Long> callback) {
		callback.onError(null);
	}

	@Override
	public void query(String query, String index,
			StoreResultCallback<Map<Integer, RequestObject>> callback) {
		callback.onError(null);
	}

	

}